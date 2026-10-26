import Papa from 'papaparse';
import { fractionDigits, tryParseMinor } from '../domain/money';
import type {
  Account,
  AccountKind,
  Budget,
  Category,
  Debt,
  RecurringRule,
  SourceRef,
  Transaction,
  TransactionType,
} from '../domain/types';
import { stripBom } from './encoding';
import { emptyPlan, type ImportPlan } from './types';

/**
 * Собственный формат CSV приложения: UTF-8 с BOM, разделитель «;», один файл со всеми данными.
 * Колонка «Тип записи» (поле type) различает операции, счета, категории, бюджеты, долги и повторы.
 * Подробное описание — в README.
 */
export const OWN_COLUMNS = [
  ['type', 'Тип записи'],
  ['id', 'ID'],
  ['name', 'Название'],
  ['kind', 'Вид'],
  ['date', 'Дата'],
  ['amount', 'Сумма'],
  ['currency', 'Валюта'],
  ['accountId', 'Счёт'],
  ['accountName', 'Счёт (название)'],
  ['toAccountId', 'Счёт-получатель'],
  ['toAmount', 'Сумма зачисления'],
  ['categoryId', 'Категория'],
  ['categoryName', 'Категория (название)'],
  ['parentId', 'Родитель'],
  ['refund', 'Возврат'],
  ['note', 'Заметка'],
  ['tags', 'Теги'],
  ['color', 'Цвет'],
  ['icon', 'Иконка'],
  ['archived', 'Скрыт'],
  ['order', 'Порядок'],
  ['initialBalance', 'Начальный баланс'],
  ['creditLimit', 'Кредитный лимит'],
  ['extra', 'Доп. данные'],
  ['source', 'Источник'],
  ['createdAt', 'Создано'],
  ['updatedAt', 'Изменено'],
] as const;

export type OwnField = (typeof OWN_COLUMNS)[number][0];
export type OwnRow = Partial<Record<OwnField, string>>;

export const RECORD_TYPES = {
  account: 'счёт',
  category: 'категория',
  budget: 'бюджет',
  debt: 'долг',
  recurring: 'повтор',
  transaction: 'операция',
} as const;

export const TX_KIND_LABELS: Record<TransactionType, string> = {
  expense: 'расход',
  income: 'доход',
  transfer: 'перевод',
};
export const ACCOUNT_KIND_CSV: Record<AccountKind, string> = {
  cash: 'наличные',
  card: 'карта',
  savings: 'накопления',
  credit: 'кредитка',
};
export const YES = 'да';

const invert = <K extends string>(map: Record<K, string>): Record<string, K> =>
  Object.fromEntries(Object.entries(map).map(([k, v]) => [v, k])) as Record<string, K>;

/** Файл в нашем формате, если в первой строке есть ключевые заголовки. */
export function isOwnCsv(text: string): boolean {
  const firstLine = stripBom(text).split(/\r?\n/, 1)[0] ?? '';
  const headers = firstLine.split(';').map((h) => h.trim().replace(/^"|"$/g, ''));
  return ['Тип записи', 'ID', 'Сумма', 'Валюта', 'Счёт'].every((h) => headers.includes(h));
}

/** Разбор собственного формата. Записи создаются с теми же ID, повторный импорт их обновляет. */
export function parseOwnCsv(text: string): ImportPlan {
  const plan = emptyPlan('own');
  const parsed = Papa.parse<string[]>(stripBom(text), {
    delimiter: ';',
    skipEmptyLines: true,
  });
  const [header, ...rows] = parsed.data;
  if (!header) {
    plan.errors.push({ message: 'Пустой файл' });
    return plan;
  }
  const byTitle = new Map<string, OwnField>(OWN_COLUMNS.map(([field, title]) => [title, field]));
  const fields = header.map((h) => byTitle.get(h.trim()));
  const txKinds = invert(TX_KIND_LABELS);
  const accountKinds = invert(ACCOUNT_KIND_CSV);

  // Операции разбираются после счетов: сумма зачисления — в валюте счёта-получателя.
  const pending: { row: OwnRow; line: number }[] = [];
  rows.forEach((cells, index) => {
    const line = index + 2;
    const row: OwnRow = {};
    fields.forEach((f, i) => {
      if (f) row[f] = cells[i] ?? '';
    });
    try {
      switch (row.type) {
        case RECORD_TYPES.account:
          plan.accounts.push(readAccount(row, accountKinds));
          break;
        case RECORD_TYPES.category:
          plan.categories.push(readCategory(row));
          break;
        case RECORD_TYPES.budget:
          plan.budgets.push(readBudget(row));
          break;
        case RECORD_TYPES.debt:
          plan.debts.push(readDebt(row));
          break;
        case RECORD_TYPES.recurring:
          plan.recurring.push(readRecurring(row, txKinds));
          break;
        case RECORD_TYPES.transaction:
          pending.push({ row, line });
          break;
        default:
          throw new Error(`неизвестный тип записи «${row.type ?? ''}»`);
      }
    } catch (e) {
      plan.errors.push({ row: line, message: (e as Error).message });
    }
  });
  const accounts = new Map(plan.accounts.map((a) => [a.id, a]));
  for (const { row, line } of pending) {
    try {
      plan.transactions.push(readTransaction(row, txKinds, accounts));
    } catch (e) {
      plan.errors.push({ row: line, message: (e as Error).message });
    }
  }
  validateReferences(plan);
  return plan;
}

function required(row: OwnRow, field: OwnField, title: string): string {
  const v = row[field]?.trim();
  if (!v) throw new Error(`не заполнено поле «${title}»`);
  return v;
}

function money(value: string | undefined, currency: string, title: string): number {
  const parsed = tryParseMinor(value ?? '', fractionDigits(currency));
  if (parsed === null) throw new Error(`неверная сумма в поле «${title}»: «${value ?? ''}»`);
  return parsed;
}

function optionalMoney(
  value: string | undefined,
  currency: string,
  title: string,
): number | undefined {
  return value?.trim() ? money(value, currency, title) : undefined;
}

function date(value: string | undefined, title: string): number {
  const ts = Date.parse(value ?? '');
  if (!Number.isFinite(ts)) throw new Error(`неверная дата в поле «${title}»: «${value ?? ''}»`);
  return ts;
}

function optional(value: string | undefined): string | undefined {
  return value?.trim() ? value : undefined;
}

function meta(row: OwnRow) {
  const source = optional(row.source);
  let src: SourceRef | undefined;
  if (source) {
    const [kind, ...rest] = source.split('|');
    if (kind === 'onemoney' || kind === 'csv') src = { kind, externalId: rest.join('|') };
  }
  return {
    id: required(row, 'id', 'ID'),
    createdAt: date(row.createdAt, 'Создано'),
    updatedAt: date(row.updatedAt, 'Изменено'),
    ...(src ? { source: src } : {}),
  };
}

function readAccount(row: OwnRow, kinds: Record<string, AccountKind>): Account {
  const currency = required(row, 'currency', 'Валюта');
  const kind = kinds[row.kind ?? ''];
  if (!kind) throw new Error(`неизвестный вид счёта «${row.kind ?? ''}»`);
  const creditLimit = optionalMoney(row.creditLimit, currency, 'Кредитный лимит');
  return {
    ...meta(row),
    name: required(row, 'name', 'Название'),
    kind,
    currency,
    initialBalance: money(row.initialBalance || '0', currency, 'Начальный баланс'),
    color: row.color ?? '',
    icon: row.icon ?? '',
    archived: row.archived === YES,
    order: Number(row.order ?? 0) || 0,
    ...(creditLimit !== undefined ? { creditLimit } : {}),
  };
}

function readCategory(row: OwnRow): Category {
  const kind = row.kind === 'расход' ? 'expense' : row.kind === 'доход' ? 'income' : null;
  if (!kind) throw new Error(`неизвестный вид категории «${row.kind ?? ''}»`);
  const parentId = optional(row.parentId);
  return {
    ...meta(row),
    name: required(row, 'name', 'Название'),
    kind,
    ...(parentId ? { parentId } : {}),
    color: row.color ?? '',
    icon: row.icon ?? '',
    archived: row.archived === YES,
    order: Number(row.order ?? 0) || 0,
  };
}

function readBudget(row: OwnRow): Budget {
  const currency = required(row, 'currency', 'Валюта');
  const startMonth = required(row, 'date', 'Дата');
  if (!/^\d{4}-\d{2}$/.test(startMonth))
    throw new Error(`месяц бюджета должен быть в виде ГГГГ-ММ`);
  return {
    ...meta(row),
    categoryId: optional(row.categoryId) ?? null,
    period: 'month',
    limit: money(row.amount, currency, 'Сумма'),
    currency,
    startMonth,
  };
}

function readDebt(row: OwnRow): Debt {
  const currency = required(row, 'currency', 'Валюта');
  const direction =
    row.kind === 'мне должны' ? 'owedToMe' : row.kind === 'я должен' ? 'iOwe' : null;
  if (!direction) throw new Error(`неизвестный вид долга «${row.kind ?? ''}»`);
  const extra = JSON.parse(row.extra || '{}') as { settled?: boolean; payments?: Debt['payments'] };
  const accountId = optional(row.accountId);
  const dueDate = optional(row.date);
  return {
    ...meta(row),
    direction,
    person: required(row, 'name', 'Название'),
    amount: money(row.amount, currency, 'Сумма'),
    currency,
    ...(accountId ? { accountId } : {}),
    ...(dueDate ? { dueDate: date(dueDate, 'Дата') } : {}),
    note: row.note ?? '',
    settled: !!extra.settled,
    payments: extra.payments ?? [],
  };
}

function splitTags(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

function readRecurring(row: OwnRow, kinds: Record<string, TransactionType>): RecurringRule {
  const currency = required(row, 'currency', 'Валюта');
  const type = kinds[row.kind ?? ''];
  if (!type) throw new Error(`неизвестный вид операции «${row.kind ?? ''}»`);
  const extra = JSON.parse(row.extra || '{}') as Pick<
    RecurringRule,
    'freq' | 'interval' | 'startDate' | 'endDate' | 'mode' | 'active' | 'lastNotifiedAt'
  >;
  if (!extra.freq || !extra.startDate) throw new Error('нет параметров повтора в «Доп. данные»');
  const toAccountId = optional(row.toAccountId);
  const categoryId = optional(row.categoryId);
  const toAmount = optionalMoney(row.toAmount, currency, 'Сумма зачисления');
  return {
    ...meta(row),
    name: required(row, 'name', 'Название'),
    template: {
      type,
      accountId: required(row, 'accountId', 'Счёт'),
      ...(toAccountId ? { toAccountId } : {}),
      ...(categoryId ? { categoryId } : {}),
      amount: money(row.amount, currency, 'Сумма'),
      ...(toAmount !== undefined ? { toAmount } : {}),
      currency,
      note: row.note ?? '',
      tags: splitTags(row.tags),
    },
    nextDate: date(row.date, 'Дата'),
    ...extra,
  };
}

function readTransaction(
  row: OwnRow,
  kinds: Record<string, TransactionType>,
  accounts: Map<string, Account>,
): Transaction {
  const currency = required(row, 'currency', 'Валюта');
  const type = kinds[row.kind ?? ''];
  if (!type) throw new Error(`неизвестный вид операции «${row.kind ?? ''}»`);
  const toAccountId = optional(row.toAccountId);
  const categoryId = optional(row.categoryId);
  if (type === 'transfer' && !toAccountId) throw new Error('у перевода не указан счёт-получатель');
  const targetCurrency = accounts.get(toAccountId ?? '')?.currency ?? currency;
  const toAmount = optionalMoney(row.toAmount, targetCurrency, 'Сумма зачисления');
  return {
    ...meta(row),
    type,
    accountId: required(row, 'accountId', 'Счёт'),
    ...(toAccountId ? { toAccountId } : {}),
    ...(categoryId ? { categoryId } : {}),
    amount: money(row.amount, currency, 'Сумма'),
    isRefund: row.refund === YES,
    currency,
    date: date(row.date, 'Дата'),
    note: row.note ?? '',
    tags: splitTags(row.tags),
    ...(toAmount !== undefined ? { toAmount } : {}),
  };
}

/** Проверяет ссылки операций на счета и категории. */
function validateReferences(plan: ImportPlan) {
  const accounts = new Set(plan.accounts.map((a) => a.id));
  const categories = new Set(plan.categories.map((c) => c.id));
  plan.transactions = plan.transactions.filter((t) => {
    if (!accounts.has(t.accountId) || (t.toAccountId && !accounts.has(t.toAccountId))) {
      plan.errors.push({ message: `Операция ${t.id}: ссылка на отсутствующий счёт` });
      return false;
    }
    if (t.categoryId && !categories.has(t.categoryId)) {
      plan.warnings.push(`Операция ${t.id}: категория ${t.categoryId} не найдена в файле`);
    }
    return true;
  });
}

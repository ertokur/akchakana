import Papa from 'papaparse';
import { isValid, parse } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import { PALETTE } from '../db/seed';
import { newId } from '../domain/ids';
import { fractionDigits, tryParseMinor } from '../domain/money';
import type {
  Account,
  Category,
  CategoryKind,
  CurrencyCode,
  Id,
  Transaction,
  TransactionType,
} from '../domain/types';
import { guessAccountKind, guessCategoryIcon } from './guess';
import { emptyPlan, type ImportPlan } from './types';

export type CsvField =
  | 'date'
  | 'amount'
  | 'currency'
  | 'category'
  | 'account'
  | 'toAccount'
  | 'note'
  | 'type'
  | 'ignore';

export const CSV_FIELD_LABELS: Record<CsvField, string> = {
  date: 'Дата',
  amount: 'Сумма',
  currency: 'Валюта',
  category: 'Категория',
  account: 'Счёт',
  toAccount: 'Счёт-получатель',
  note: 'Заметка',
  type: 'Тип',
  ignore: 'Не импортировать',
};

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
  delimiter: string;
}

/** Разбор CSV с автоопределением разделителя «,» или «;». */
export function parseCsv(text: string): ParsedCsv {
  const result = Papa.parse<string[]>(text, {
    delimitersToGuess: [';', ','],
    skipEmptyLines: 'greedy',
  });
  const [headers = [], ...rows] = result.data;
  return { headers: headers.map((h) => h.trim()), rows, delimiter: result.meta.delimiter };
}

const SYNONYMS: [CsvField, RegExp][] = [
  ['date', /^(дата|date|время|datetime|day|день)/i],
  ['amount', /^(сумма|amount|sum|value|итого)/i],
  ['currency', /^(валюта|currency|cur)/i],
  ['toAccount', /(получател|на счёт|на счет|to.?account|target)/i],
  ['account', /^(сч[её]т|account|кошел|wallet|карта|card)/i],
  ['category', /^(категор|category|статья)/i],
  ['note', /^(заметк|комментар|описани|note|comment|memo|description|назначение)/i],
  ['type', /^(тип|вид|type|kind)/i],
];

/** Подсказка сопоставления колонок по названиям (русским и английским). */
export function guessMapping(headers: string[]): CsvField[] {
  const used = new Set<CsvField>();
  return headers.map((h) => {
    const match = SYNONYMS.find(([field, re]) => !used.has(field) && re.test(h.trim()));
    if (!match) return 'ignore';
    used.add(match[0]);
    return match[0];
  });
}

export const DATE_FORMATS = ['dd.MM.yyyy', 'yyyy-MM-dd', 'dd/MM/yyyy'] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];
const TIME_SUFFIXES = ['', ' HH:mm', ' HH:mm:ss', "'T'HH:mm", "'T'HH:mm:ss"];

/** Разбирает дату в одном из форматов (с временем или без) как время в поясе пользователя. */
export function parseCsvDate(value: string, format: DateFormat, timeZone: string): number | null {
  const v = value.trim();
  for (const suffix of TIME_SUFFIXES) {
    const d = parse(v, format + suffix, new Date(2000, 0, 1));
    if (isValid(d) && d.getFullYear() > 1900) {
      const pad = (n: number) => String(n).padStart(2, '0');
      const wall = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      return fromZonedTime(wall, timeZone).getTime();
    }
  }
  return null;
}

/** Формат дат, под который подходит больше всего значений из первых 50 строк. */
export function detectDateFormat(values: string[]): DateFormat | null {
  const sample = values.filter((v) => v.trim()).slice(0, 50);
  let best: DateFormat | null = null;
  let bestCount = 0;
  for (const f of DATE_FORMATS) {
    const count = sample.filter((v) => parseCsvDate(v, f, 'UTC') !== null).length;
    if (count > bestCount) {
      best = f;
      bestCount = count;
    }
  }
  return best;
}

function parseType(value: string): TransactionType | null {
  const v = value.trim().toLowerCase();
  if (/^(расход|expense|списание|out|-)/.test(v)) return 'expense';
  if (/^(доход|income|поступление|зачисление|in|\+)/.test(v)) return 'income';
  if (/^(перевод|transfer)/.test(v)) return 'transfer';
  return null;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/ё/g, 'е');

export interface CsvImportOptions {
  mapping: CsvField[];
  dateFormat: DateFormat;
  timeZone: string;
  defaultCurrency: CurrencyCode;
  /** Счёт для строк без колонки «Счёт». */
  defaultAccountId?: Id;
  /** Названия новых счетов и категорий, которые пользователь разрешил создать. */
  createAccounts: Set<string>;
  createCategories: Set<string>;
  includeDuplicates: boolean;
  now?: number;
}

export interface CsvAnalysis {
  plan: ImportPlan;
  /** Счета и категории из файла, которых нет в приложении. */
  missingAccounts: string[];
  missingCategories: { name: string; kind: CategoryKind }[];
}

/** Ключ дубликата: дата до минуты, сумма, счёт, заметка. */
export function duplicateKey(
  t: Pick<Transaction, 'date' | 'amount' | 'accountId' | 'note'>,
): string {
  return `${Math.floor(t.date / 60_000)}|${t.amount}|${t.accountId}|${t.note.trim().toLowerCase()}`;
}

export function analyzeCsv(
  csv: ParsedCsv,
  options: CsvImportOptions,
  existing: { accounts: Account[]; categories: Category[]; transactions: Transaction[] },
): CsvAnalysis {
  const now = options.now ?? Date.now();
  const plan = emptyPlan('csv');
  const col = (field: CsvField) => options.mapping.indexOf(field);
  const idx = {
    date: col('date'),
    amount: col('amount'),
    currency: col('currency'),
    category: col('category'),
    account: col('account'),
    toAccount: col('toAccount'),
    note: col('note'),
    type: col('type'),
  };
  if (idx.date < 0 || idx.amount < 0) {
    plan.errors.push({ message: 'Нужно сопоставить хотя бы колонки «Дата» и «Сумма»' });
    return { plan, missingAccounts: [], missingCategories: [] };
  }
  if (idx.account < 0 && !options.defaultAccountId) {
    plan.errors.push({ message: 'Выберите счёт для операций или колонку «Счёт»' });
    return { plan, missingAccounts: [], missingCategories: [] };
  }

  const accountsByName = new Map(existing.accounts.map((a) => [norm(a.name), a]));
  const categoriesByName = new Map(
    existing.categories.map((c) => [`${c.kind}|${norm(c.name)}`, c]),
  );
  const missingAccounts = new Map<string, string>();
  const missingCategories = new Map<string, { name: string; kind: CategoryKind }>();
  let color = existing.accounts.length + existing.categories.length;

  const resolveAccount = (name: string, currency: CurrencyCode): Account | null => {
    const key = norm(name);
    const found = accountsByName.get(key);
    if (found) return found;
    if (!missingAccounts.has(key)) missingAccounts.set(key, name.trim());
    if (!options.createAccounts.has(name.trim())) return null;
    const kind = guessAccountKind(name);
    const account: Account = {
      id: newId(),
      name: name.trim(),
      kind,
      currency,
      initialBalance: 0,
      color: PALETTE[color++ % PALETTE.length],
      icon: kind === 'card' ? 'credit-card' : kind === 'savings' ? 'piggy-bank' : 'wallet',
      archived: false,
      order: existing.accounts.length + plan.accounts.length,
      createdAt: now,
      updatedAt: now,
    };
    accountsByName.set(key, account);
    plan.accounts.push(account);
    return account;
  };

  const resolveCategory = (name: string, kind: CategoryKind): Category | null => {
    const key = `${kind}|${norm(name)}`;
    const found = categoriesByName.get(key);
    if (found) return found;
    if (!missingCategories.has(key)) missingCategories.set(key, { name: name.trim(), kind });
    if (!options.createCategories.has(`${kind}|${name.trim()}`)) return null;
    const category: Category = {
      id: newId(),
      name: name.trim(),
      kind,
      color: PALETTE[color++ % PALETTE.length],
      icon: guessCategoryIcon(name),
      archived: false,
      order: existing.categories.filter((c) => c.kind === kind).length + plan.categories.length,
      createdAt: now,
      updatedAt: now,
    };
    categoriesByName.set(key, category);
    plan.categories.push(category);
    return category;
  };

  const defaultAccount = existing.accounts.find((a) => a.id === options.defaultAccountId);
  const seen = new Set(existing.transactions.map(duplicateKey));

  csv.rows.forEach((cells, i) => {
    const line = i + 2;
    const cell = (k: keyof typeof idx) => (idx[k] >= 0 ? (cells[idx[k]] ?? '').trim() : '');
    const fail = (message: string) => plan.errors.push({ row: line, message });

    const date = parseCsvDate(cell('date'), options.dateFormat, options.timeZone);
    if (date === null) return fail(`неверная дата «${cell('date')}»`);

    const accountName = cell('account');
    let currency = cell('currency').toUpperCase() || undefined;
    let account: Account | null | undefined = defaultAccount;
    if (accountName) {
      account = resolveAccount(accountName, currency ?? options.defaultCurrency);
      if (!account) return fail(`счёт «${accountName}» не найден`);
    }
    if (!account) return fail('не указан счёт');
    currency ??= account.currency;
    if (currency !== account.currency) {
      return fail(
        `валюта ${currency} не совпадает с валютой счёта «${account.name}» (${account.currency})`,
      );
    }

    const raw = tryParseMinor(cell('amount'), fractionDigits(currency));
    if (raw === null) return fail(`неверная сумма «${cell('amount')}»`);
    if (raw === 0) return fail('нулевая сумма');

    let type: TransactionType;
    let amount = raw;
    const typeCell = cell('type');
    if (typeCell) {
      const parsed = parseType(typeCell);
      if (!parsed) return fail(`неизвестный тип операции «${typeCell}»`);
      type = parsed;
      // Тип указан явно — знак суммы не важен (банки часто пишут расходы со знаком минус).
      amount = Math.abs(amount);
    } else {
      type = amount < 0 ? 'expense' : 'income';
      amount = Math.abs(amount);
    }

    let toAccountId: Id | undefined;
    let categoryId: Id | undefined;
    if (type === 'transfer') {
      const targetName = cell('toAccount');
      if (!targetName) return fail('у перевода нет счёта-получателя');
      const target = resolveAccount(targetName, currency);
      if (!target) return fail(`счёт «${targetName}» не найден`);
      if (target.id === account.id) return fail('перевод на тот же счёт');
      toAccountId = target.id;
      amount = Math.abs(amount);
    } else if (cell('category')) {
      const category = resolveCategory(cell('category'), type);
      if (!category) return fail(`категория «${cell('category')}» не найдена`);
      categoryId = category.id;
    }

    const t: Transaction = {
      id: newId(),
      type,
      accountId: account.id,
      ...(toAccountId ? { toAccountId } : {}),
      ...(categoryId ? { categoryId } : {}),
      amount,
      isRefund: amount < 0,
      currency,
      date,
      note: cell('note'),
      tags: [],
      createdAt: now,
      updatedAt: now,
      source: { kind: 'csv', externalId: `csv:${line}` },
    };
    const key = duplicateKey(t);
    if (seen.has(key) && !options.includeDuplicates) {
      plan.duplicates.push(t);
      return;
    }
    seen.add(key);
    plan.transactions.push(t);
  });

  return {
    plan,
    missingAccounts: [...missingAccounts.values()],
    missingCategories: [...missingCategories.values()],
  };
}

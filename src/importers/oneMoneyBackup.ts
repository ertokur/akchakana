import type { Database, SqlJsStatic, SqlValue } from 'sql.js';
import { PALETTE } from '../db/seed';
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

/**
 * Адаптер резервной копии 1Money (SQLite). Файл открывается в памяти через sql.js,
 * выполняются только SELECT — исходный файл не изменяется.
 *
 * Имена колонок сокращены и на русском так в самом файле:
 *   tr — операции (_id, _b_i снимок, _ty тип, _a_i счёт/источник, _d_i категория/получатель,
 *        _da дата в мс, _a_m сумма строкой, _co заметка);
 *   de — счета и категории (_id, _b_i, _na название, _ty, _ic иконка, _ar архив);
 *   bu — порядок категорий (_or).
 */

/** Индексы иконок 1Money → наши ключи. Пока соответствие неизвестно, иконка подбирается по названию. */
export const ONE_MONEY_ICON_MAP: Record<number, string> = {};

const TR_TYPES: Record<number, TransactionType> = { 0: 'expense', 1: 'income', 2: 'transfer' };
const SERVICE_ROW_NAME = 'All accounts';
const SERVICE_ROW_TYPE = 4;

type Row = Record<string, SqlValue>;

function select(db: Database, sql: string): Row[] {
  if (!/^\s*(SELECT|PRAGMA)\b/i.test(sql)) throw new Error('Разрешены только запросы на чтение');
  const result = db.exec(sql);
  if (result.length === 0) return [];
  const { columns, values } = result[0];
  return values.map((v) => Object.fromEntries(columns.map((c, i) => [c, v[i]])));
}

function tableColumns(db: Database, table: string): string[] {
  return select(db, `PRAGMA table_info(${table})`).map((r) => String(r.name));
}

function hasTable(db: Database, table: string): boolean {
  return (
    select(db, `SELECT name FROM sqlite_master WHERE type = 'table' AND name = '${table}'`).length >
    0
  );
}

const num = (v: SqlValue): number => (typeof v === 'number' ? v : Number(v));
const str = (v: SqlValue): string => (v === null || v === undefined ? '' : String(v));

export const oneMoneyIds = {
  transaction: (id: SqlValue) => `onemoney-tr-${str(id)}`,
  entity: (id: SqlValue) => `onemoney-de-${str(id)}`,
};

export interface OneMoneyOptions {
  currency: CurrencyCode;
  /** Момент импорта — для createdAt/updatedAt. */
  now?: number;
}

export function parseOneMoneyBackup(
  SQL: SqlJsStatic,
  bytes: Uint8Array,
  { currency, now = Date.now() }: OneMoneyOptions,
): ImportPlan {
  // sql.js работает с копией байтов в памяти; оригинал не трогаем.
  const db = new SQL.Database(new Uint8Array(bytes));
  try {
    return readBackup(db, currency, now);
  } finally {
    db.close();
  }
}

function readBackup(db: Database, currency: CurrencyCode, now: number): ImportPlan {
  const plan = emptyPlan('onemoney');
  for (const table of ['tr', 'de']) {
    if (!hasTable(db, table)) {
      plan.errors.push({
        message: `В файле нет таблицы «${table}» — это не резервная копия 1Money`,
      });
      return plan;
    }
  }
  const digits = fractionDigits(currency);

  // 1. Операции только из последнего снимка; остальные считаются удалёнными.
  const trRows = select(
    db,
    'SELECT _id, _ty, _a_i, _d_i, _da, _a_m, _co FROM tr WHERE _b_i = (SELECT MAX(_b_i) FROM tr)',
  );

  // 2. Роли строк de определяются по ссылкам из операций.
  const accountRefs = new Set<string>();
  const categoryRefs = new Map<string, CategoryKind>();
  for (const r of trRows) {
    const type = TR_TYPES[num(r._ty)];
    if (!type) continue;
    accountRefs.add(str(r._a_i));
    if (type === 'transfer') accountRefs.add(str(r._d_i));
    else if (r._d_i !== null) categoryRefs.set(str(r._d_i), type);
  }
  for (const id of accountRefs) {
    if (categoryRefs.has(id)) {
      plan.warnings.push(
        `Запись #${id} используется и как счёт, и как категория — импортирована как счёт`,
      );
      categoryRefs.delete(id);
    }
  }

  // 3. Последняя версия каждой строки de: из последнего снимка, иначе самая свежая.
  const deRows = new Map<string, Row>();
  for (const r of select(db, 'SELECT * FROM de ORDER BY _b_i ASC')) deRows.set(str(r._id), r);

  const accountTypes = new Set<number>();
  for (const id of accountRefs) {
    const r = deRows.get(id);
    if (r) accountTypes.add(num(r._ty));
  }

  const order = readCategoryOrder(db, deRows, plan);
  const accounts = new Map<string, Account>();
  const categories = new Map<string, Category>();
  let colorIndex = 0;
  const nextColor = () => PALETTE[colorIndex++ % PALETTE.length];

  const makeAccount = (id: string, r: Row | undefined): Account => {
    const name = r ? str(r._na) || `Счёт ${id}` : `Счёт ${id}`;
    const kind = guessAccountKind(name);
    return {
      id: oneMoneyIds.entity(id),
      name,
      kind,
      currency,
      initialBalance: 0,
      color: nextColor(),
      icon:
        kind === 'card'
          ? 'credit-card'
          : kind === 'savings'
            ? 'piggy-bank'
            : kind === 'credit'
              ? 'landmark'
              : 'wallet',
      archived: r ? num(r._ar) === 1 : false,
      order: accounts.size,
      createdAt: now,
      updatedAt: now,
      source: { kind: 'onemoney', externalId: `onemoney:de:${id}` },
    };
  };

  const makeCategory = (id: string, kind: CategoryKind, r: Row | undefined): Category => {
    const name = r ? str(r._na) || `Категория ${id}` : `Категория ${id}`;
    const iconIndex = r ? num(r._ic) : NaN;
    return {
      id: oneMoneyIds.entity(id),
      name,
      kind,
      color: nextColor(),
      icon:
        ONE_MONEY_ICON_MAP[iconIndex] ??
        guessCategoryIcon(name, kind === 'income' ? 'dollar' : 'tag'),
      archived: r ? num(r._ar) === 1 : false,
      order: order.get(id) ?? Number.MAX_SAFE_INTEGER,
      createdAt: now,
      updatedAt: now,
      source: { kind: 'onemoney', externalId: `onemoney:de:${id}` },
    };
  };

  for (const id of accountRefs) {
    const r = deRows.get(id);
    if (!r) plan.warnings.push(`Счёт #${id} не найден в таблице de — создан с временным названием`);
    accounts.set(id, makeAccount(id, r));
  }
  for (const [id, kind] of categoryRefs) {
    const r = deRows.get(id);
    if (!r)
      plan.warnings.push(
        `Категория #${id} не найдена в таблице de — создана с временным названием`,
      );
    else {
      const expected = kind === 'expense' ? 1 : 0;
      if (num(r._ty) !== expected) {
        plan.warnings.push(
          `Категория «${str(r._na)}» используется в ${kind === 'expense' ? 'расходах' : 'доходах'}, хотя её тип в файле — ${num(r._ty)}`,
        );
      }
    }
    categories.set(id, makeCategory(id, kind, r));
  }

  // 4. Строки de без ссылок: категории по _ty (1 — расход, 0 — доход), счета — по типу известных счетов.
  for (const [id, r] of deRows) {
    if (accounts.has(id) || categories.has(id)) continue;
    const ty = num(r._ty);
    if (str(r._na) === SERVICE_ROW_NAME && ty === SERVICE_ROW_TYPE) continue;
    if (ty === 1 || ty === 0)
      categories.set(id, makeCategory(id, ty === 1 ? 'expense' : 'income', r));
    else if (accountTypes.has(ty)) accounts.set(id, makeAccount(id, r));
    else plan.warnings.push(`Пропущена запись «${str(r._na)}» (#${id}) неизвестного типа ${ty}`);
  }

  // Порядок категорий: по bu._or, затем по названию; нумеруем подряд по каждому типу.
  for (const kind of ['expense', 'income'] as const) {
    [...categories.values()]
      .filter((c) => c.kind === kind)
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'ru'))
      .forEach((c, i) => (c.order = i));
  }

  // 5. Операции.
  const transactions: Transaction[] = [];
  for (const r of trRows) {
    const id = str(r._id);
    const type = TR_TYPES[num(r._ty)];
    if (!type) {
      plan.errors.push({ message: `Операция #${id}: неизвестный тип ${str(r._ty)}` });
      continue;
    }
    const amount = tryParseMinor(str(r._a_m), digits);
    if (amount === null) {
      plan.errors.push({ message: `Операция #${id}: не удалось прочитать сумму «${str(r._a_m)}»` });
      continue;
    }
    const date = num(r._da);
    if (!Number.isFinite(date)) {
      plan.errors.push({ message: `Операция #${id}: неверная дата «${str(r._da)}»` });
      continue;
    }
    const account = accounts.get(str(r._a_i))!;
    const target = type === 'transfer' ? accounts.get(str(r._d_i)) : undefined;
    const category =
      type !== 'transfer' && r._d_i !== null ? categories.get(str(r._d_i)) : undefined;
    transactions.push({
      id: oneMoneyIds.transaction(id),
      type,
      accountId: account.id,
      toAccountId: target?.id,
      categoryId: category?.id,
      // Знак операции задаёт тип; отрицательная сумма — возврат, хранится как есть.
      amount,
      isRefund: amount < 0,
      currency,
      date,
      note: str(r._co),
      tags: [],
      createdAt: now,
      updatedAt: now,
      source: { kind: 'onemoney', externalId: `onemoney:tr:${id}` },
    });
  }

  plan.accounts = [...accounts.values()];
  plan.categories = [...categories.values()];
  plan.transactions = transactions;
  return plan;
}

/**
 * Порядок категорий из bu._or. Колонка-ссылка на de._id ищется по схеме:
 * сначала колонки с характерными именами, затем любые, значения которых — id из de.
 */
function readCategoryOrder(
  db: Database,
  deRows: Map<string, Row>,
  plan: ImportPlan,
): Map<Id, number> {
  const order = new Map<Id, number>();
  if (!hasTable(db, 'bu')) return order;
  const columns = tableColumns(db, 'bu');
  if (!columns.includes('_or')) {
    plan.warnings.push('В таблице bu нет колонки _or — категории отсортированы по названию');
    return order;
  }
  const hasSnapshot = columns.includes('_b_i');
  const rows = select(db, `SELECT * FROM bu${hasSnapshot ? ' ORDER BY _b_i ASC' : ''}`);
  const preferred = ['_d_i', '_c_i', '_ca_i', '_de_i', '_de'];
  const candidates = [
    ...preferred.filter((c) => columns.includes(c)),
    ...columns.filter((c) => !preferred.includes(c) && !['_id', '_b_i', '_or'].includes(c)),
    '_id',
  ].filter((c) => columns.includes(c));
  const link = candidates.find((c) => {
    const values = rows.map((r) => r[c]).filter((v) => v !== null);
    return values.length > 0 && values.every((v) => deRows.has(str(v)));
  });
  if (!link) {
    plan.warnings.push(
      'Не удалось связать порядок категорий (bu) с категориями — отсортированы по названию',
    );
    return order;
  }
  // Более поздние снимки перезаписывают ранние.
  for (const r of rows) order.set(str(r[link]), num(r._or));
  return order;
}

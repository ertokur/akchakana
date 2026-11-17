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
import { t as tr } from '../i18n';

/**
 * Адаптер резервной копии в формате SQLite (сторонние приложения учёта). Файл открывается в памяти через sql.js,
 * выполняются только SELECT — исходный файл не изменяется.
 *
 * Копия содержит ежедневные снимки (`_b_i`) всей базы. Берётся только последний снимок:
 * записей, которых в нём нет, в исходном приложении уже не существует (в старых снимках лежат,
 * например, стандартные английские категории прошлых установок и удалённые счета).
 *
 * Колонки (сокращённые имена — так в самом файле):
 *   tr — операции: _ty (0 расход, 1 доход, 2 перевод), _a_i счёт (у перевода — источник),
 *        _d_i категория (у перевода — получатель), _da дата в мс, _a_m сумма строкой,
 *        _d_m сумма зачисления строкой, _co заметка;
 *   de — счета и категории: _na название, _ty (1 — категория расхода; 0 — счёт или
 *        категория дохода; 4 — служебная «All accounts»), _a_m_b начальный баланс
 *        (есть только у счетов), _pi родительская категория, _co цвет ARGB, _ic иконка,
 *        _ar архив, _a_o порядок счетов;
 *   bu — порядок категорий: _id → _or.
 */

/**
 * Номера иконок из резервной копии → наши ключи (подобраны по реальной копии).
 * Неизвестный номер — иконка подбирается по названию категории.
 */
export const BACKUP_ICON_MAP: Record<number, string> = {
  1: 'dots',
  3: 'piggy-bank',
  4: 'credit-card',
  14: 'cart',
  15: 'utensils',
  16: 'gamepad',
  17: 'bus',
  19: 'home',
  20: 'heart-pulse',
  21: 'tag',
  24: 'gift',
  76: 'car',
  79: 'fuel',
  132: 'briefcase',
  204: 'sparkles',
  285: 'landmark',
};

const TR_TYPES: Record<number, TransactionType> = { 0: 'expense', 1: 'income', 2: 'transfer' };
const SERVICE_ROW_TYPE = 4;

type Row = Record<string, SqlValue>;

function select(db: Database, sql: string): Row[] {
  if (!/^\s*(SELECT|PRAGMA)\b/i.test(sql)) throw new Error(tr('import.err.readOnly'));
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
const isSet = (v: SqlValue | undefined): boolean => v !== null && v !== undefined && v !== '';

/** Цвет Android (знаковое целое ARGB) → `#rrggbb`. */
export function argbToHex(value: SqlValue): string | null {
  if (!isSet(value)) return null;
  const n = num(value);
  if (!Number.isFinite(n)) return null;
  return `#${((n >>> 0) & 0xffffff).toString(16).padStart(6, '0')}`;
}

export const backupIds = {
  transaction: (id: SqlValue) => `ext-tr-${str(id)}`,
  entity: (id: SqlValue) => `ext-de-${str(id)}`,
};

export interface SqliteBackupOptions {
  currency: CurrencyCode;
  /** Момент импорта — для createdAt/updatedAt. */
  now?: number;
}

export function parseSqliteBackup(
  SQL: SqlJsStatic,
  bytes: Uint8Array,
  { currency, now = Date.now() }: SqliteBackupOptions,
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
  const plan = emptyPlan('backup');
  for (const table of ['tr', 'de']) {
    if (!hasTable(db, table)) {
      plan.errors.push({
        message: tr('import.err.noTable', { table }),
      });
      return plan;
    }
  }
  const digits = fractionDigits(currency);
  const trColumns = new Set(tableColumns(db, 'tr'));
  const hasToAmount = trColumns.has('_d_m');

  // 1. Операции только из последнего снимка.
  const trRows = select(
    db,
    `SELECT _id, _ty, _a_i, _d_i, _da, _a_m, ${hasToAmount ? '_d_m' : 'NULL AS _d_m'}, _co
     FROM tr WHERE _b_i = (SELECT MAX(_b_i) FROM tr)`,
  );

  // 2. Счета и категории из последнего снимка; из более старых — только те, на которые
  //    ещё ссылаются операции (такого быть не должно, но не теряем данные).
  const latest = new Map<string, Row>();
  for (const r of select(db, 'SELECT * FROM de WHERE _b_i = (SELECT MAX(_b_i) FROM de)')) {
    latest.set(str(r._id), r);
  }
  const referenced = new Set<string>();
  for (const r of trRows) {
    referenced.add(str(r._a_i));
    if (r._d_i !== null) referenced.add(str(r._d_i));
  }
  const missing = [...referenced].filter((id) => !latest.has(id));
  if (missing.length) {
    const older = select(db, 'SELECT * FROM de ORDER BY _b_i ASC');
    for (const r of older) if (missing.includes(str(r._id))) latest.set(str(r._id), r);
  }

  // 3. Роли. Счёт — строка с начальным балансом (_a_m_b) или та, что стоит в роли счёта
  //    в операциях. Остальное: _ty = 1 — расход, _ty = 0 — доход.
  const accountRefs = new Set<string>();
  const categoryUse = new Map<string, CategoryKind>();
  for (const r of trRows) {
    const type = TR_TYPES[num(r._ty)];
    if (!type) continue;
    accountRefs.add(str(r._a_i));
    if (type === 'transfer') accountRefs.add(str(r._d_i));
    else if (r._d_i !== null) categoryUse.set(str(r._d_i), type);
  }
  const roles = new Map<string, 'account' | CategoryKind>();
  for (const [id, r] of latest) {
    const ty = num(r._ty);
    if (ty === SERVICE_ROW_TYPE) continue;
    if (isSet(r._a_m_b) || accountRefs.has(id)) roles.set(id, 'account');
    else if (categoryUse.has(id)) roles.set(id, categoryUse.get(id)!);
    else if (ty === 1) roles.set(id, 'expense');
    else if (ty === 0) roles.set(id, 'income');
    else plan.warnings.push(tr('import.warn.unknownRecord', { name: str(r._na), type: ty }));
  }
  for (const id of referenced) {
    if (!roles.has(id)) {
      // Ссылка на запись, которой нет ни в одном снимке.
      roles.set(id, accountRefs.has(id) ? 'account' : (categoryUse.get(id) ?? 'expense'));
      plan.warnings.push(tr('import.warn.missingRecord', { id }));
    }
  }
  for (const [id, kind] of categoryUse) {
    if (roles.get(id) === 'account') {
      plan.warnings.push(tr('import.warn.bothRoles', { name: str(latest.get(id)?._na ?? id) }));
    } else if (roles.get(id) !== kind) {
      roles.set(id, kind);
    }
  }

  const order = readCategoryOrder(db, latest);
  let colorIndex = 0;
  const fallbackColor = () => PALETTE[colorIndex++ % PALETTE.length];
  const meta = (id: string) => ({
    id: backupIds.entity(id),
    createdAt: now,
    updatedAt: now,
    source: { kind: 'backup' as const, externalId: `backup:de:${id}` },
  });

  // 4. Счета с начальными балансами.
  const accounts: Account[] = [];
  for (const [id, role] of roles) {
    if (role !== 'account') continue;
    const r = latest.get(id);
    const name = (r ? str(r._na).trim() : '') || tr('import.placeholderAccount', { id });
    const kind = guessAccountKind(name);
    let initialBalance = 0;
    if (r && isSet(r._a_m_b)) {
      const parsed = tryParseMinor(str(r._a_m_b), digits);
      if (parsed === null) {
        plan.warnings.push(tr('import.warn.badInitial', { name, value: str(r._a_m_b) }));
      } else initialBalance = parsed;
    }
    const iconIndex = r ? num(r._ic) : NaN;
    accounts.push({
      ...meta(id),
      name,
      kind,
      currency,
      initialBalance,
      color: (r && argbToHex(r._co)) ?? fallbackColor(),
      icon:
        BACKUP_ICON_MAP[iconIndex] ??
        (kind === 'card' ? 'credit-card' : kind === 'savings' ? 'piggy-bank' : 'wallet'),
      archived: r ? num(r._ar) === 1 : false,
      order: r && isSet(r._a_o) ? num(r._a_o) : accounts.length,
    });
  }
  accounts.sort((a, b) => a.order - b.order).forEach((a, i) => (a.order = i));

  // 5. Категории и подкатегории (_pi — родитель).
  const categories: Category[] = [];
  for (const [id, role] of roles) {
    if (role === 'account') continue;
    const r = latest.get(id);
    const name = (r ? str(r._na).trim() : '') || tr('import.placeholderCategory', { id });
    const parentRaw = r && isSet(r._pi) ? str(r._pi) : undefined;
    const parentRole = parentRaw ? roles.get(parentRaw) : undefined;
    const parentId = parentRaw && parentRole === role ? backupIds.entity(parentRaw) : undefined;
    if (parentRaw && !parentId) {
      plan.warnings.push(tr('import.warn.orphanSub', { name }));
    }
    const iconIndex = r ? num(r._ic) : NaN;
    categories.push({
      ...meta(id),
      name,
      kind: role,
      ...(parentId ? { parentId } : {}),
      color: (r && argbToHex(r._co)) ?? fallbackColor(),
      icon:
        BACKUP_ICON_MAP[iconIndex] ?? guessCategoryIcon(name, role === 'income' ? 'dollar' : 'tag'),
      archived: r ? num(r._ar) === 1 : false,
      order: order.get(id) ?? Number.MAX_SAFE_INTEGER,
    });
  }
  // Порядок: по bu._or, затем по названию; нумерация подряд внутри каждого родителя.
  const groups = new Map<string, Category[]>();
  for (const c of categories) {
    const key = `${c.kind}|${c.parentId ?? ''}`;
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  for (const list of groups.values()) {
    list
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'ru'))
      .forEach((c, i) => (c.order = i));
  }

  // 6. Операции.
  const accountIds = new Set(accounts.map((a) => a.id));
  const categoryIds = new Set(categories.map((c) => c.id));
  const transactions: Transaction[] = [];
  for (const r of trRows) {
    const id = str(r._id);
    const type = TR_TYPES[num(r._ty)];
    if (!type) {
      plan.errors.push({ message: tr('import.err.txUnknownType', { id, type: str(r._ty) }) });
      continue;
    }
    const amount = tryParseMinor(str(r._a_m), digits);
    if (amount === null) {
      plan.errors.push({ message: tr('import.err.txBadAmount', { id, value: str(r._a_m) }) });
      continue;
    }
    const date = num(r._da);
    if (!Number.isFinite(date)) {
      plan.errors.push({ message: tr('import.err.txBadDate', { id, value: str(r._da) }) });
      continue;
    }
    const accountId = backupIds.entity(r._a_i);
    if (!accountIds.has(accountId)) {
      plan.errors.push({
        message: tr('import.err.txAccountNotFound', { id, account: str(r._a_i) }),
      });
      continue;
    }
    const t: Transaction = {
      id: backupIds.transaction(id),
      type,
      accountId,
      // Знак операции задаёт тип; отрицательная сумма — возврат, хранится как есть.
      amount,
      isRefund: amount < 0,
      currency,
      date,
      note: str(r._co).trim(),
      tags: [],
      createdAt: now,
      updatedAt: now,
      source: { kind: 'backup', externalId: `backup:tr:${id}` },
    };
    if (type === 'transfer') {
      const toAccountId = backupIds.entity(r._d_i);
      if (!accountIds.has(toAccountId) || toAccountId === accountId) {
        plan.errors.push({ message: tr('import.err.txBadTarget', { id }) });
        continue;
      }
      t.toAccountId = toAccountId;
      t.isRefund = false;
      const toAmount = isSet(r._d_m) ? tryParseMinor(str(r._d_m), digits) : null;
      if (toAmount !== null && toAmount !== amount) t.toAmount = toAmount;
    } else if (r._d_i !== null) {
      const categoryId = backupIds.entity(r._d_i);
      if (categoryIds.has(categoryId)) t.categoryId = categoryId;
    }
    transactions.push(t);
  }

  plan.accounts = accounts;
  plan.categories = categories;
  plan.transactions = transactions;
  return plan;
}

/**
 * Порядок категорий из bu (последний снимок). Ссылка на de — колонка `_id`;
 * в старом формате могла быть отдельная колонка, её ищем по совпадению значений.
 */
function readCategoryOrder(db: Database, entities: Map<string, Row>): Map<Id, number> {
  const order = new Map<Id, number>();
  if (!hasTable(db, 'bu')) return order;
  const columns = tableColumns(db, 'bu');
  if (!columns.includes('_or')) return order;
  const hasSnapshot = columns.includes('_b_i');
  const rows = select(
    db,
    `SELECT * FROM bu${hasSnapshot ? ' WHERE _b_i = (SELECT MAX(_b_i) FROM bu)' : ''}`,
  );
  const candidates = [
    ...['_d_i', '_c_i', '_ca_i', '_de_i'].filter((c) => columns.includes(c)),
    '_id',
  ].filter((c) => columns.includes(c));
  const link = candidates.find((c) => {
    const values = rows.map((r) => r[c]).filter((v) => v !== null);
    return values.length > 0 && values.every((v) => entities.has(str(v)));
  });
  if (!link) return order;
  for (const r of rows) {
    if (r._or === null) continue;
    order.set(str(r[link]), num(r._or));
  }
  return order;
}

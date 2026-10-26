import Papa from 'papaparse';
import { toIsoWithOffset } from '../domain/dates';
import { fractionDigits, toDecimalString } from '../domain/money';
import type {
  Account,
  Budget,
  Category,
  Debt,
  Id,
  RecurringRule,
  SourceRef,
  Timestamp,
  Transaction,
} from '../domain/types';
import { BOM } from '../importers/encoding';
import {
  ACCOUNT_KIND_CSV,
  OWN_COLUMNS,
  RECORD_TYPES,
  TX_KIND_LABELS,
  YES,
  type OwnRow,
} from '../importers/ownCsv';

export interface ExportData {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  recurring: RecurringRule[];
  debts: Debt[];
}

export interface ExportFilter {
  /** Период операций [from, to), UTC мс; не задан — всё время. */
  from?: Timestamp;
  to?: Timestamp;
  /** Счета, операции которых попадут в файл; не задано — все. */
  accountIds?: Id[];
}

/** Применяет фильтр к операциям; справочники (счета, категории, бюджеты…) выгружаются целиком. */
export function filterExport(data: ExportData, filter: ExportFilter): ExportData {
  const ids = filter.accountIds ? new Set(filter.accountIds) : null;
  return {
    ...data,
    transactions: data.transactions.filter(
      (t) =>
        (filter.from === undefined || t.date >= filter.from) &&
        (filter.to === undefined || t.date < filter.to) &&
        (!ids || ids.has(t.accountId) || (t.toAccountId !== undefined && ids.has(t.toAccountId))),
    ),
  };
}

const money = (minor: number, currency: string) =>
  toDecimalString(minor, fractionDigits(currency), ',');
const sourceCell = (s?: SourceRef) => (s ? `${s.kind}|${s.externalId}` : '');

/** Собирает CSV собственного формата: UTF-8 с BOM, разделитель «;», заголовки на русском. */
export function buildOwnCsv(data: ExportData, timeZone: string): string {
  const iso = (ts: Timestamp) => toIsoWithOffset(ts, timeZone);
  const accountName = new Map(data.accounts.map((a) => [a.id, a.name]));
  const categoryName = new Map(data.categories.map((c) => [c.id, c.name]));
  const currencyOf = new Map(data.accounts.map((a) => [a.id, a.currency]));
  const rows: OwnRow[] = [];
  const base = (e: { id: Id; createdAt: Timestamp; updatedAt: Timestamp; source?: SourceRef }) => ({
    id: e.id,
    createdAt: iso(e.createdAt),
    updatedAt: iso(e.updatedAt),
    source: sourceCell(e.source),
  });

  for (const a of data.accounts) {
    rows.push({
      ...base(a),
      type: RECORD_TYPES.account,
      name: a.name,
      kind: ACCOUNT_KIND_CSV[a.kind],
      currency: a.currency,
      initialBalance: money(a.initialBalance, a.currency),
      creditLimit: a.creditLimit !== undefined ? money(a.creditLimit, a.currency) : '',
      color: a.color,
      icon: a.icon,
      archived: a.archived ? YES : '',
      order: String(a.order),
    });
  }
  // Родители раньше подкатегорий — так файл удобно читать.
  const categories = [...data.categories].sort(
    (a, b) => Number(!!a.parentId) - Number(!!b.parentId),
  );
  for (const c of categories) {
    rows.push({
      ...base(c),
      type: RECORD_TYPES.category,
      name: c.name,
      kind: c.kind === 'expense' ? 'расход' : 'доход',
      parentId: c.parentId ?? '',
      color: c.color,
      icon: c.icon,
      archived: c.archived ? YES : '',
      order: String(c.order),
    });
  }
  for (const b of data.budgets) {
    rows.push({
      ...base(b),
      type: RECORD_TYPES.budget,
      kind: 'месяц',
      date: b.startMonth,
      amount: money(b.limit, b.currency),
      currency: b.currency,
      categoryId: b.categoryId ?? '',
      categoryName: b.categoryId ? (categoryName.get(b.categoryId) ?? '') : 'Все расходы',
    });
  }
  for (const d of data.debts) {
    rows.push({
      ...base(d),
      type: RECORD_TYPES.debt,
      name: d.person,
      kind: d.direction === 'owedToMe' ? 'мне должны' : 'я должен',
      amount: money(d.amount, d.currency),
      currency: d.currency,
      accountId: d.accountId ?? '',
      date: d.dueDate !== undefined ? iso(d.dueDate) : '',
      note: d.note,
      extra: JSON.stringify({ settled: d.settled, payments: d.payments }),
    });
  }
  for (const r of data.recurring) {
    const t = r.template;
    rows.push({
      ...base(r),
      type: RECORD_TYPES.recurring,
      name: r.name,
      kind: TX_KIND_LABELS[t.type],
      date: iso(r.nextDate),
      amount: money(t.amount, t.currency),
      currency: t.currency,
      accountId: t.accountId,
      accountName: accountName.get(t.accountId) ?? '',
      toAccountId: t.toAccountId ?? '',
      toAmount:
        t.toAmount !== undefined
          ? money(t.toAmount, currencyOf.get(t.toAccountId ?? '') ?? t.currency)
          : '',
      categoryId: t.categoryId ?? '',
      categoryName: t.categoryId ? (categoryName.get(t.categoryId) ?? '') : '',
      note: t.note,
      tags: t.tags.join(', '),
      extra: JSON.stringify({
        freq: r.freq,
        interval: r.interval,
        startDate: r.startDate,
        endDate: r.endDate,
        mode: r.mode,
        active: r.active,
        lastNotifiedAt: r.lastNotifiedAt,
      }),
    });
  }
  const transactions = [...data.transactions].sort((a, b) => a.date - b.date);
  for (const t of transactions) {
    rows.push({
      ...base(t),
      type: RECORD_TYPES.transaction,
      kind: TX_KIND_LABELS[t.type],
      date: iso(t.date),
      amount: money(t.amount, t.currency),
      currency: t.currency,
      accountId: t.accountId,
      accountName: accountName.get(t.accountId) ?? '',
      toAccountId: t.toAccountId ?? '',
      toAmount:
        t.toAmount !== undefined
          ? money(t.toAmount, currencyOf.get(t.toAccountId ?? '') ?? t.currency)
          : '',
      categoryId: t.categoryId ?? '',
      categoryName: t.categoryId ? (categoryName.get(t.categoryId) ?? '') : '',
      refund: t.isRefund ? YES : '',
      note: t.note,
      tags: t.tags.join(', '),
    });
  }

  const csv = Papa.unparse(
    {
      fields: OWN_COLUMNS.map(([, title]) => title),
      data: rows.map((r) => OWN_COLUMNS.map(([field]) => r[field] ?? '')),
    },
    { delimiter: ';', newline: '\r\n', quotes: false },
  );
  return BOM + csv;
}

export function exportFileName(now: Timestamp, timeZone: string): string {
  return `akchakana-${toIsoWithOffset(now, timeZone).slice(0, 10)}.csv`;
}

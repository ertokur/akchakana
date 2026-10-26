import { signedAmount } from '../../domain/balances';
import { dayKey } from '../../domain/dates';
import type { CurrencyCode, Minor, Transaction } from '../../domain/types';

export interface DayGroup {
  key: string;
  items: Transaction[];
  /** Итог дня по валютам: доходы минус расходы, переводы не влияют. */
  totals: Map<CurrencyCode, Minor>;
}

/** Группирует операции по дням в часовом поясе пользователя, новые сверху. */
export function groupByDay(transactions: Transaction[], timeZone: string): DayGroup[] {
  const groups = new Map<string, DayGroup>();
  const sorted = [...transactions].sort((a, b) => b.date - a.date || b.createdAt - a.createdAt);
  for (const t of sorted) {
    const key = dayKey(t.date, timeZone);
    let g = groups.get(key);
    if (!g) {
      g = { key, items: [], totals: new Map() };
      groups.set(key, g);
    }
    g.items.push(t);
    if (t.type !== 'transfer') {
      g.totals.set(t.currency, (g.totals.get(t.currency) ?? 0) + signedAmount(t));
    }
  }
  return [...groups.values()];
}

/** Операции в периоде с фильтром по счёту (перевод попадает в оба счёта). */
export function filterTransactions(
  transactions: Transaction[],
  start: number,
  end: number,
  accountId: string | 'all',
): Transaction[] {
  return transactions.filter(
    (t) =>
      t.date >= start &&
      t.date < end &&
      (accountId === 'all' || t.accountId === accountId || t.toAccountId === accountId),
  );
}

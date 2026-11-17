import type { CurrencyCode, Debt, DebtDirection, Minor, Timestamp } from './types';

/** Сколько уже погашено. */
export function debtPaid(d: Debt): Minor {
  return d.payments.reduce((sum, p) => sum + p.amount, 0);
}

/** Остаток долга: сумма минус погашения (не меньше нуля). */
export function debtRemaining(d: Debt): Minor {
  return Math.max(0, d.amount - debtPaid(d));
}

/** Срок возврата прошёл, а долг не закрыт. */
export function isDebtOverdue(d: Debt, now: Timestamp): boolean {
  return !d.settled && d.dueDate !== undefined && d.dueDate < now && debtRemaining(d) > 0;
}

/** Открытые долги по направлению и валюте. */
export function debtTotals(debts: Debt[]): Record<DebtDirection, Map<CurrencyCode, Minor>> {
  const result: Record<DebtDirection, Map<CurrencyCode, Minor>> = {
    owedToMe: new Map(),
    iOwe: new Map(),
  };
  for (const d of debts) {
    if (d.settled) continue;
    const remaining = debtRemaining(d);
    if (remaining === 0) continue;
    const map = result[d.direction];
    map.set(d.currency, (map.get(d.currency) ?? 0) + remaining);
  }
  return result;
}

/**
 * Порядок в списке: открытые — сначала просроченные и с ближайшим сроком, без срока — в конце
 * (новые выше); закрытые — недавно изменённые выше.
 */
export function sortDebts(debts: Debt[]): { open: Debt[]; settled: Debt[] } {
  const open = debts
    .filter((d) => !d.settled)
    .sort((a, b) => (a.dueDate ?? Infinity) - (b.dueDate ?? Infinity) || b.createdAt - a.createdAt);
  const settled = debts.filter((d) => d.settled).sort((a, b) => b.updatedAt - a.updatedAt);
  return { open, settled };
}

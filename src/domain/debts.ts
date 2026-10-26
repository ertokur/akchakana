import type { CurrencyCode, Debt, DebtDirection, Minor } from './types';

/** Остаток долга: сумма минус погашения (не меньше нуля). */
export function debtRemaining(d: Debt): Minor {
  const paid = d.payments.reduce((sum, p) => sum + p.amount, 0);
  return Math.max(0, d.amount - paid);
}

/** Открытые долги по направлению и валюте. */
export function debtTotals(debts: Debt[]): Record<DebtDirection, Map<CurrencyCode, Minor>> {
  const result: Record<DebtDirection, Map<CurrencyCode, Minor>> = {
    owedToMe: new Map(),
    iOwe: new Map(),
  };
  for (const d of debts) {
    if (d.settled) continue;
    const map = result[d.direction];
    map.set(d.currency, (map.get(d.currency) ?? 0) + debtRemaining(d));
  }
  return result;
}

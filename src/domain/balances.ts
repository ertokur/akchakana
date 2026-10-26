import type { Account, CurrencyCode, Id, Minor, Transaction } from './types';

/** Баланс каждого счёта: начальный баланс + доходы − расходы ± переводы. */
export function computeBalances(accounts: Account[], transactions: Transaction[]): Map<Id, Minor> {
  const balances = new Map<Id, Minor>();
  for (const a of accounts) balances.set(a.id, a.initialBalance);
  const add = (id: Id | undefined, delta: Minor) => {
    if (id === undefined || !balances.has(id)) return;
    balances.set(id, (balances.get(id) ?? 0) + delta);
  };
  for (const t of transactions) {
    switch (t.type) {
      case 'expense':
        add(t.accountId, -t.amount);
        break;
      case 'income':
        add(t.accountId, t.amount);
        break;
      case 'transfer':
        add(t.accountId, -t.amount);
        add(t.toAccountId, t.toAmount ?? t.amount);
        break;
    }
  }
  return balances;
}

/** Суммарный баланс по валютам (курсы не конвертируются — внешних API нет). */
export function totalsByCurrency(
  accounts: Account[],
  balances: Map<Id, Minor>,
): Map<CurrencyCode, Minor> {
  const totals = new Map<CurrencyCode, Minor>();
  for (const a of accounts) {
    if (a.archived) continue;
    totals.set(a.currency, (totals.get(a.currency) ?? 0) + (balances.get(a.id) ?? 0));
  }
  return totals;
}

export interface FlowSummary {
  income: Minor;
  expense: Minor;
  balance: Minor;
}

/** Доходы и расходы в одной валюте. Переводы не учитываются, возвраты (минус) уменьшают итог. */
export function summarize(transactions: Transaction[], currency?: CurrencyCode): FlowSummary {
  let income = 0;
  let expense = 0;
  for (const t of transactions) {
    if (currency && t.currency !== currency) continue;
    if (t.type === 'income') income += t.amount;
    else if (t.type === 'expense') expense += t.amount;
  }
  return { income, expense, balance: income - expense };
}

/** Знаковый эффект операции для итога дня: доход +, расход −, перевод 0. */
export function signedAmount(t: Transaction): Minor {
  if (t.type === 'income') return t.amount;
  if (t.type === 'expense') return -t.amount;
  return 0;
}

import { monthKey } from './dates';
import type { Budget, Category, Id, Minor, Transaction } from './types';

export interface BudgetStatus {
  budget: Budget;
  spent: Minor;
  limit: Minor;
  /** spent / limit; > 1 — превышение. */
  ratio: number;
  level: 'ok' | 'warning' | 'over';
}

/** Категория и все её подкатегории. */
export function categoryWithChildren(categoryId: Id, categories: Category[]): Set<Id> {
  const ids = new Set<Id>([categoryId]);
  let added = true;
  while (added) {
    added = false;
    for (const c of categories) {
      if (c.parentId && ids.has(c.parentId) && !ids.has(c.id)) {
        ids.add(c.id);
        added = true;
      }
    }
  }
  return ids;
}

export function isBudgetActive(budget: Budget, month: string): boolean {
  return budget.startMonth <= month;
}

/** Расходы за месяц `yyyy-MM` в валюте бюджета по его категории (или по всем расходам). */
export function budgetSpent(
  budget: Budget,
  month: string,
  transactions: Transaction[],
  categories: Category[],
  timeZone: string,
): Minor {
  const ids = budget.categoryId ? categoryWithChildren(budget.categoryId, categories) : null;
  let spent = 0;
  for (const t of transactions) {
    if (t.type !== 'expense' || t.currency !== budget.currency) continue;
    if (ids && (!t.categoryId || !ids.has(t.categoryId))) continue;
    if (monthKey(t.date, timeZone) !== month) continue;
    spent += t.amount;
  }
  return spent;
}

export function budgetStatus(
  budget: Budget,
  month: string,
  transactions: Transaction[],
  categories: Category[],
  timeZone: string,
): BudgetStatus {
  const spent = budgetSpent(budget, month, transactions, categories, timeZone);
  const ratio = budget.limit > 0 ? spent / budget.limit : 0;
  return {
    budget,
    spent,
    limit: budget.limit,
    ratio,
    level: ratio > 1 ? 'over' : ratio >= 0.8 ? 'warning' : 'ok',
  };
}

/** Бюджеты, на которые влияет операция. */
export function budgetsAffectedBy(
  t: Transaction,
  budgets: Budget[],
  categories: Category[],
): Budget[] {
  if (t.type !== 'expense') return [];
  return budgets.filter(
    (b) =>
      b.currency === t.currency &&
      (b.categoryId === null ||
        (t.categoryId !== undefined &&
          categoryWithChildren(b.categoryId, categories).has(t.categoryId))),
  );
}

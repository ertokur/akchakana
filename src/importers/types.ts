import type {
  Account,
  Budget,
  Category,
  CurrencyCode,
  Debt,
  RecurringRule,
  Timestamp,
  Transaction,
} from '../domain/types';

export interface RowError {
  /** Номер строки в исходном файле (с 1, включая заголовок), если применимо. */
  row?: number;
  message: string;
}

/** Результат разбора файла: что будет записано после подтверждения. */
export interface ImportPlan {
  format: 'onemoney' | 'csv' | 'own';
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  recurring: RecurringRule[];
  debts: Debt[];
  /** Найденные дубликаты, которые будут пропущены. */
  duplicates: Transaction[];
  warnings: string[];
  errors: RowError[];
}

export function emptyPlan(format: ImportPlan['format']): ImportPlan {
  return {
    format,
    accounts: [],
    categories: [],
    transactions: [],
    budgets: [],
    recurring: [],
    debts: [],
    duplicates: [],
    warnings: [],
    errors: [],
  };
}

export interface PlanSummary {
  transactions: number;
  expenses: number;
  incomes: number;
  transfers: number;
  refunds: number;
  accounts: number;
  categories: number;
  hiddenCategories: number;
  budgets: number;
  recurring: number;
  debts: number;
  duplicates: number;
  from?: Timestamp;
  to?: Timestamp;
  currencies: CurrencyCode[];
}

export function summarizePlan(plan: ImportPlan): PlanSummary {
  const t = plan.transactions;
  const dates = t.map((x) => x.date);
  return {
    transactions: t.length,
    expenses: t.filter((x) => x.type === 'expense').length,
    incomes: t.filter((x) => x.type === 'income').length,
    transfers: t.filter((x) => x.type === 'transfer').length,
    refunds: t.filter((x) => x.isRefund).length,
    accounts: plan.accounts.length,
    categories: plan.categories.length,
    hiddenCategories: plan.categories.filter((c) => c.archived).length,
    budgets: plan.budgets.length,
    recurring: plan.recurring.length,
    debts: plan.debts.length,
    duplicates: plan.duplicates.length,
    from: dates.length ? Math.min(...dates) : undefined,
    to: dates.length ? Math.max(...dates) : undefined,
    currencies: [
      ...new Set([...t.map((x) => x.currency), ...plan.accounts.map((a) => a.currency)]),
    ],
  };
}

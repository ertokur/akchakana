import Dexie, { type Table } from 'dexie';
import type {
  Account,
  Budget,
  Category,
  Debt,
  RecurringRule,
  Settings,
  Transaction,
} from '../domain/types';

export const DB_NAME = 'akchakana';

/**
 * Схема IndexedDB. Каждая новая версия добавляется ниже предыдущей и не меняет старые:
 * Dexie сам применяет цепочку `upgrade` при открытии базы старой версии.
 */
export const SCHEMA_V1 = {
  accounts: 'id, order, archived',
  categories: 'id, kind, parentId, order',
  transactions: 'id, date, accountId, toAccountId, categoryId, [accountId+date], source.externalId',
  budgets: 'id, categoryId',
  recurring: 'id, nextDate',
  debts: 'id, settled',
  settings: 'id',
};

/** v2: индекс по тегам; заполнение tags/isRefund у записей, созданных до появления полей. */
export const SCHEMA_V2 = {
  ...SCHEMA_V1,
  transactions: `${SCHEMA_V1.transactions}, *tags`,
};

export class AppDb extends Dexie {
  accounts!: Table<Account, string>;
  categories!: Table<Category, string>;
  transactions!: Table<Transaction, string>;
  budgets!: Table<Budget, string>;
  recurring!: Table<RecurringRule, string>;
  debts!: Table<Debt, string>;
  settings!: Table<Settings, string>;

  constructor(name = DB_NAME) {
    super(name);
    this.version(1).stores(SCHEMA_V1);
    this.version(2)
      .stores(SCHEMA_V2)
      .upgrade((tx) =>
        tx
          .table('transactions')
          .toCollection()
          .modify((t: Partial<Transaction>) => {
            if (!Array.isArray(t.tags)) t.tags = [];
            if (typeof t.isRefund !== 'boolean') t.isRefund = (t.amount ?? 0) < 0;
          }),
      );
  }
}

export const DB_TABLES = [
  'accounts',
  'categories',
  'transactions',
  'budgets',
  'recurring',
  'debts',
  'settings',
] as const;

import type { Table } from 'dexie';
import { AppDb, DB_TABLES } from '../db/dexie';
import { DEFAULT_SETTINGS, type Id, type Settings, type Transaction } from '../domain/types';
import type { Repositories, Repository, SettingsRepository, TransactionRepository } from './types';

function tableRepository<T extends { id: Id }>(table: Table<T, Id>): Repository<T> {
  return {
    getAll: () => table.toArray(),
    get: (id) => table.get(id),
    put: async (item) => {
      await table.put(item);
    },
    bulkPut: async (items) => {
      await table.bulkPut(items);
    },
    delete: (id) => table.delete(id),
    bulkDelete: (ids) => table.bulkDelete(ids),
  };
}

function transactionRepository(db: AppDb): TransactionRepository {
  return {
    ...tableRepository<Transaction>(db.transactions),
    listInRange: (start, end) =>
      db.transactions.where('date').between(start, end, true, false).toArray(),
    findBySourceIds: (externalIds) =>
      externalIds.length === 0
        ? Promise.resolve([])
        : db.transactions.where('source.externalId').anyOf(externalIds).toArray(),
    countReferences: async (id) => {
      const [byAccount, byTarget, byCategory] = await Promise.all([
        db.transactions.where('accountId').equals(id).count(),
        db.transactions.where('toAccountId').equals(id).count(),
        db.transactions.where('categoryId').equals(id).count(),
      ]);
      return byAccount + byTarget + byCategory;
    },
  };
}

function settingsRepository(db: AppDb): SettingsRepository {
  const get = async (): Promise<Settings> => ({
    ...DEFAULT_SETTINGS,
    ...(await db.settings.get('settings')),
  });
  return {
    get,
    update: async (patch) => {
      const next: Settings = { ...(await get()), ...patch, id: 'settings' };
      await db.settings.put(next);
      return next;
    },
  };
}

export function createDexieRepositories(db: AppDb): Repositories {
  return {
    accounts: tableRepository(db.accounts),
    categories: tableRepository(db.categories),
    transactions: transactionRepository(db),
    budgets: tableRepository(db.budgets),
    recurring: tableRepository(db.recurring),
    debts: tableRepository(db.debts),
    settings: settingsRepository(db),
    atomically: (fn) => db.transaction('rw', [...DB_TABLES], fn),
    clearAll: () =>
      db.transaction('rw', [...DB_TABLES], async () => {
        await Promise.all(DB_TABLES.map((name) => db.table(name).clear()));
      }),
  };
}

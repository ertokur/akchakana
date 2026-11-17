import type {
  Account,
  BackupSnapshot,
  Budget,
  Category,
  Debt,
  Id,
  RecurringRule,
  Settings,
  Timestamp,
  Transaction,
} from '../domain/types';

/**
 * Интерфейсы хранилища. UI и сторы знают только о них, поэтому позже можно добавить
 * реализацию с синхронизацией, не трогая экраны.
 */
export interface Repository<T extends { id: Id }> {
  getAll(): Promise<T[]>;
  get(id: Id): Promise<T | undefined>;
  put(item: T): Promise<void>;
  bulkPut(items: T[]): Promise<void>;
  delete(id: Id): Promise<void>;
  bulkDelete(ids: Id[]): Promise<void>;
}

export interface TransactionRepository extends Repository<Transaction> {
  listInRange(start: Timestamp, end: Timestamp): Promise<Transaction[]>;
  findBySourceIds(externalIds: string[]): Promise<Transaction[]>;
  /** Сколько операций ссылается на счёт или категорию (для запрета удаления). */
  countReferences(id: Id): Promise<number>;
}

export interface SettingsRepository {
  get(): Promise<Settings>;
  update(patch: Partial<Omit<Settings, 'id'>>): Promise<Settings>;
}

export interface BackupRepository {
  /** Все внутренние копии, новые первыми. */
  list(): Promise<BackupSnapshot[]>;
  put(item: BackupSnapshot): Promise<void>;
  bulkDelete(ids: Id[]): Promise<void>;
}

export interface Repositories {
  accounts: Repository<Account>;
  categories: Repository<Category>;
  transactions: TransactionRepository;
  budgets: Repository<Budget>;
  recurring: Repository<RecurringRule>;
  debts: Repository<Debt>;
  settings: SettingsRepository;
  backups: BackupRepository;
  /** Выполнить несколько операций атомарно (импорт, сброс). */
  atomically<R>(fn: () => Promise<R>): Promise<R>;
  /** Полная очистка всех данных. */
  clearAll(): Promise<void>;
}

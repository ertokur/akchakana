import { create } from 'zustand';
import {
  DEFAULT_SETTINGS,
  type Account,
  type Budget,
  type Category,
  type Debt,
  type Id,
  type RecurringRule,
  type Settings,
  type Transaction,
} from '../domain/types';
import { getRepositories } from '../repositories';

/**
 * Данные приложения в памяти. Источник истины — репозитории (IndexedDB);
 * каждое действие сначала пишет в репозиторий, затем обновляет состояние.
 * Объёмы личного учёта (десятки тысяч операций) спокойно помещаются в память.
 */
interface DataState {
  loaded: boolean;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  recurring: RecurringRule[];
  debts: Debt[];
  settings: Settings;

  load(): Promise<void>;
  updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<void>;

  saveTransaction(t: Transaction): Promise<void>;
  saveTransactions(ts: Transaction[]): Promise<void>;
  deleteTransaction(id: Id): Promise<Transaction | undefined>;

  saveAccount(a: Account): Promise<void>;
  deleteAccount(id: Id): Promise<void>;
  saveCategory(c: Category): Promise<void>;
  saveCategories(cs: Category[]): Promise<void>;
  deleteCategory(id: Id): Promise<void>;

  saveBudget(b: Budget): Promise<void>;
  deleteBudget(id: Id): Promise<void>;
  saveRecurring(r: RecurringRule): Promise<void>;
  deleteRecurring(id: Id): Promise<void>;
  saveDebt(d: Debt): Promise<void>;
  deleteDebt(id: Id): Promise<void>;

  resetAll(): Promise<void>;
}

function upsert<T extends { id: Id }>(list: T[], items: T[]): T[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const result = list.map((i) => byId.get(i.id) ?? i);
  const existing = new Set(list.map((i) => i.id));
  for (const item of items) if (!existing.has(item.id)) result.push(item);
  return result;
}

const without = <T extends { id: Id }>(list: T[], id: Id) => list.filter((i) => i.id !== id);

export const useData = create<DataState>((set, get) => ({
  loaded: false,
  accounts: [],
  categories: [],
  transactions: [],
  budgets: [],
  recurring: [],
  debts: [],
  settings: DEFAULT_SETTINGS,

  async load() {
    const r = getRepositories();
    const [accounts, categories, transactions, budgets, recurring, debts, settings] =
      await Promise.all([
        r.accounts.getAll(),
        r.categories.getAll(),
        r.transactions.getAll(),
        r.budgets.getAll(),
        r.recurring.getAll(),
        r.debts.getAll(),
        r.settings.get(),
      ]);
    set({
      loaded: true,
      accounts,
      categories,
      transactions,
      budgets,
      recurring,
      debts,
      settings,
    });
  },

  async updateSettings(patch) {
    const settings = await getRepositories().settings.update(patch);
    set({ settings });
  },

  async saveTransaction(t) {
    await getRepositories().transactions.put(t);
    set({ transactions: upsert(get().transactions, [t]) });
  },
  async saveTransactions(ts) {
    await getRepositories().transactions.bulkPut(ts);
    set({ transactions: upsert(get().transactions, ts) });
  },
  async deleteTransaction(id) {
    const existing = get().transactions.find((t) => t.id === id);
    await getRepositories().transactions.delete(id);
    set({ transactions: without(get().transactions, id) });
    return existing;
  },

  async saveAccount(a) {
    await getRepositories().accounts.put(a);
    set({ accounts: upsert(get().accounts, [a]) });
  },
  async deleteAccount(id) {
    await getRepositories().accounts.delete(id);
    set({ accounts: without(get().accounts, id) });
  },
  async saveCategory(c) {
    await getRepositories().categories.put(c);
    set({ categories: upsert(get().categories, [c]) });
  },
  async saveCategories(cs) {
    await getRepositories().categories.bulkPut(cs);
    set({ categories: upsert(get().categories, cs) });
  },
  async deleteCategory(id) {
    await getRepositories().categories.delete(id);
    set({ categories: without(get().categories, id) });
  },

  async saveBudget(b) {
    await getRepositories().budgets.put(b);
    set({ budgets: upsert(get().budgets, [b]) });
  },
  async deleteBudget(id) {
    await getRepositories().budgets.delete(id);
    set({ budgets: without(get().budgets, id) });
  },
  async saveRecurring(r) {
    await getRepositories().recurring.put(r);
    set({ recurring: upsert(get().recurring, [r]) });
  },
  async deleteRecurring(id) {
    await getRepositories().recurring.delete(id);
    set({ recurring: without(get().recurring, id) });
  },
  async saveDebt(d) {
    await getRepositories().debts.put(d);
    set({ debts: upsert(get().debts, [d]) });
  },
  async deleteDebt(id) {
    await getRepositories().debts.delete(id);
    set({ debts: without(get().debts, id) });
  },

  async resetAll() {
    await getRepositories().clearAll();
    await get().load();
  },
}));

/** Сортировка по order, затем по имени. */
export function byOrder<T extends { order: number; name: string }>(a: T, b: T): number {
  return a.order - b.order || a.name.localeCompare(b.name, 'ru');
}

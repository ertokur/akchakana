import { AppDb } from '../src/db/dexie';
import { defaultCategories, makeAccount } from '../src/db/seed';
import { DEFAULT_SETTINGS, type Account, type Transaction } from '../src/domain/types';
import { createDexieRepositories } from '../src/repositories/dexieRepositories';
import { setRepositories, type Repositories } from '../src/repositories';
import { useData } from '../src/stores/dataStore';
import { useUi } from '../src/stores/uiStore';

let counter = 0;

/** Отдельная база fake-indexeddb на каждый тест и сброс сторов. */
export async function setupTestRepos(): Promise<{ db: AppDb; repos: Repositories }> {
  const db = new AppDb(`test-${Date.now()}-${counter++}`);
  const repos = createDexieRepositories(db);
  setRepositories(repos);
  useData.setState({
    loaded: false,
    accounts: [],
    categories: [],
    transactions: [],
    budgets: [],
    recurring: [],
    debts: [],
    settings: DEFAULT_SETTINGS,
  });
  useUi.setState({
    period: { kind: 'month', anchor: Date.now() },
    accountFilter: 'all',
    editor: { mode: 'closed' },
    toasts: [],
  });
  return { db, repos };
}

/** Онбординг пройден, есть счёт «Наличные» и стандартные категории. */
export async function seedBasic(repos: Repositories): Promise<{ account: Account }> {
  const account = makeAccount({ name: 'Наличные', currency: 'KGS', initialBalance: 100000 });
  await repos.accounts.put(account);
  await repos.categories.bulkPut(defaultCategories());
  await repos.settings.update({ onboarded: true });
  return { account };
}

export function makeTx(p: Partial<Transaction>): Transaction {
  return {
    id: `t-${counter++}`,
    type: 'expense',
    accountId: 'a',
    amount: 100,
    isRefund: false,
    currency: 'KGS',
    date: Date.now(),
    note: '',
    tags: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...p,
  };
}

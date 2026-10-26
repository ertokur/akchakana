import Dexie from 'dexie';
import { AppDb, SCHEMA_V1 } from '../db/dexie';
import { defaultCategories, makeAccount } from '../db/seed';
import type { Transaction } from '../domain/types';
import { createDexieRepositories } from './dexieRepositories';

let counter = 0;
const uniqueName = () => `test-${Date.now()}-${counter++}`;

const tx = (p: Partial<Transaction>): Transaction => ({
  id: `t${counter++}`,
  type: 'expense',
  accountId: 'a',
  amount: 100,
  isRefund: false,
  currency: 'KGS',
  date: 0,
  note: '',
  tags: [],
  createdAt: 0,
  updatedAt: 0,
  ...p,
});

describe('репозитории Dexie', () => {
  let db: AppDb;
  beforeEach(() => {
    db = new AppDb(uniqueName());
  });
  afterEach(async () => {
    await db.delete();
  });

  it('CRUD счетов и категорий', async () => {
    const repos = createDexieRepositories(db);
    const acc = makeAccount({ name: 'Наличные', currency: 'KGS' });
    await repos.accounts.put(acc);
    expect(await repos.accounts.get(acc.id)).toEqual(acc);
    await repos.accounts.put({ ...acc, name: 'Кошелёк' });
    expect((await repos.accounts.getAll()).map((a) => a.name)).toEqual(['Кошелёк']);
    await repos.accounts.delete(acc.id);
    expect(await repos.accounts.getAll()).toEqual([]);

    const cats = defaultCategories();
    await repos.categories.bulkPut(cats);
    expect(await repos.categories.getAll()).toHaveLength(cats.length);
  });

  it('операции: выборка по периоду, источнику и ссылкам', async () => {
    const repos = createDexieRepositories(db);
    await repos.transactions.bulkPut([
      tx({ id: 'x1', date: 100, categoryId: 'food' }),
      tx({ id: 'x2', date: 200, source: { kind: 'onemoney', externalId: 'onemoney:5' } }),
      tx({ id: 'x3', date: 300, type: 'transfer', toAccountId: 'b' }),
    ]);
    expect((await repos.transactions.listInRange(100, 300)).map((t) => t.id).sort()).toEqual([
      'x1',
      'x2',
    ]);
    expect((await repos.transactions.findBySourceIds(['onemoney:5']))[0].id).toBe('x2');
    expect(await repos.transactions.countReferences('a')).toBe(3);
    expect(await repos.transactions.countReferences('b')).toBe(1);
    expect(await repos.transactions.countReferences('food')).toBe(1);
  });

  it('настройки: значения по умолчанию и обновление', async () => {
    const repos = createDexieRepositories(db);
    expect((await repos.settings.get()).timeZone).toBe('Asia/Bishkek');
    await repos.settings.update({ defaultCurrency: 'USD' });
    const s = await repos.settings.get();
    expect(s.defaultCurrency).toBe('USD');
    expect(s.weekStartsOn).toBe(1);
  });

  it('atomically откатывает всё при ошибке', async () => {
    const repos = createDexieRepositories(db);
    await expect(
      repos.atomically(async () => {
        await repos.accounts.put(makeAccount({ name: 'A', currency: 'KGS' }));
        throw new Error('сбой');
      }),
    ).rejects.toThrow('сбой');
    expect(await repos.accounts.getAll()).toEqual([]);
  });

  it('clearAll очищает все таблицы', async () => {
    const repos = createDexieRepositories(db);
    await repos.accounts.put(makeAccount({ name: 'A', currency: 'KGS' }));
    await repos.transactions.put(tx({}));
    await repos.settings.update({ onboarded: true });
    await repos.clearAll();
    expect(await repos.accounts.getAll()).toEqual([]);
    expect(await repos.transactions.getAll()).toEqual([]);
    expect((await repos.settings.get()).onboarded).toBe(false);
  });
});

describe('миграции схемы', () => {
  it('v1 → v2 заполняет tags и isRefund', async () => {
    const name = uniqueName();
    const v1 = new Dexie(name);
    v1.version(1).stores(SCHEMA_V1);
    await v1.table('transactions').bulkPut([
      { id: 'old1', type: 'expense', accountId: 'a', amount: 500, date: 1, currency: 'KGS' },
      { id: 'old2', type: 'expense', accountId: 'a', amount: -500, date: 2, currency: 'KGS' },
    ]);
    v1.close();

    const db = new AppDb(name);
    const rows = await db.transactions.orderBy('date').toArray();
    expect(rows.map((r) => [r.tags, r.isRefund])).toEqual([
      [[], false],
      [[], true],
    ]);
    expect(db.verno).toBe(2);
    await db.delete();
  });
});

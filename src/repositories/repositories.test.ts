import Dexie from 'dexie';
import { AppDb, SCHEMA_V1, SCHEMA_V2, SCHEMA_V3 } from '../db/dexie';
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
      tx({ id: 'x2', date: 200, source: { kind: 'backup', externalId: 'backup:5' } }),
      tx({ id: 'x3', date: 300, type: 'transfer', toAccountId: 'b' }),
    ]);
    expect((await repos.transactions.listInRange(100, 300)).map((t) => t.id).sort()).toEqual([
      'x1',
      'x2',
    ]);
    expect((await repos.transactions.findBySourceIds(['backup:5']))[0].id).toBe('x2');
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

  it('одновременные изменения настроек не теряются', async () => {
    const repos = createDexieRepositories(db);
    await Promise.all([
      repos.settings.update({ theme: 'dark' }),
      repos.settings.update({ weekStartsOn: 0 }),
      repos.settings.update({ lastExportAt: 5 }),
    ]);
    expect(await repos.settings.get()).toMatchObject({
      theme: 'dark',
      weekStartsOn: 0,
      lastExportAt: 5,
    });
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
  it('v3 → v4 приводит ID и источник записей из резервной копии к единому виду', async () => {
    const name = uniqueName();
    const v3 = new Dexie(name);
    v3.version(3).stores(SCHEMA_V3);
    const src = (kind: string, ext: string) => ({ kind, externalId: ext });
    await v3
      .table('accounts')
      .put({ id: 'legacy-de-1', name: 'Карта', source: src('legacy', 'legacy:de:1') });
    await v3.table('categories').bulkPut([
      { id: 'legacy-de-10', name: 'Еда', source: src('legacy', 'legacy:de:10') },
      { id: 'legacy-de-11', name: 'Рынок', parentId: 'legacy-de-10' },
      { id: 'own-uuid', name: 'Своя', parentId: 'legacy-de-10' },
    ]);
    await v3.table('transactions').bulkPut([
      {
        id: 'legacy-tr-5',
        type: 'expense',
        accountId: 'legacy-de-1',
        categoryId: 'legacy-de-11',
        amount: 100,
        date: 1,
        tags: [],
        isRefund: false,
        source: src('legacy', 'legacy:tr:5'),
      },
      {
        id: 'manual',
        type: 'expense',
        accountId: 'legacy-de-1',
        amount: 1,
        date: 2,
        tags: [],
        isRefund: false,
      },
    ]);
    await v3.table('budgets').put({ id: 'b', categoryId: 'legacy-de-10' });
    await v3
      .table('recurring')
      .put({ id: 'r', template: { accountId: 'legacy-de-1', categoryId: 'legacy-de-10' } });
    v3.close();

    const db = new AppDb(name);
    expect(db.verno).toBe(4);
    expect((await db.accounts.toArray()).map((a) => [a.id, a.source])).toEqual([
      ['ext-de-1', { kind: 'backup', externalId: 'backup:de:1' }],
    ]);
    const cats = Object.fromEntries((await db.categories.toArray()).map((c) => [c.id, c.parentId]));
    expect(cats).toEqual({
      'ext-de-10': undefined,
      'ext-de-11': 'ext-de-10',
      'own-uuid': 'ext-de-10',
    });
    const txs = await db.transactions.orderBy('date').toArray();
    expect(txs.map((t) => [t.id, t.accountId, t.categoryId, t.source?.externalId])).toEqual([
      ['ext-tr-5', 'ext-de-1', 'ext-de-11', 'backup:tr:5'],
      ['manual', 'ext-de-1', undefined, undefined],
    ]);
    expect((await db.budgets.get('b'))?.categoryId).toBe('ext-de-10');
    expect((await db.recurring.get('r'))?.template).toEqual({
      accountId: 'ext-de-1',
      categoryId: 'ext-de-10',
    });
    await db.delete();
  });

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
    expect(db.verno).toBe(4);
    await db.delete();
  });

  it('v2 → v3 сохраняет данные и добавляет таблицу резервных копий', async () => {
    const name = uniqueName();
    const v2 = new Dexie(name);
    v2.version(1).stores(SCHEMA_V1);
    v2.version(2).stores(SCHEMA_V2);
    await v2.table('settings').put({ id: 'settings', onboarded: true, lastExportAt: 7 });
    v2.close();

    const db = new AppDb(name);
    const repos = createDexieRepositories(db);
    const settings = await repos.settings.get();
    expect(settings.onboarded).toBe(true);
    expect(settings.lastExportAt).toBe(7);
    // Новые поля получают значения по умолчанию.
    expect(settings.autoBackupEnabled).toBe(true);
    expect(settings.autoBackupFrequency).toBe('weekly');
    expect(await repos.backups.list()).toEqual([]);
    expect(db.verno).toBe(4);
    await db.delete();
  });

  it('сброс данных не удаляет внутренние резервные копии', async () => {
    const db = new AppDb(uniqueName());
    const repos = createDexieRepositories(db);
    await repos.backups.put({
      id: 'b1',
      createdAt: 1,
      fileName: 'akchakana-backup-2026-01-01.csv',
      content: 'x',
      size: 1,
      transactions: 0,
    });
    await repos.clearAll();
    expect(await repos.backups.list()).toHaveLength(1);
    await db.delete();
  });
});

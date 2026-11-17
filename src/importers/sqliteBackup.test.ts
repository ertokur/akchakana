import type { SqlJsStatic } from 'sql.js';
import { computeBalances } from '../domain/balances';
import { dayKey } from '../domain/dates';
import { isSqlite, detectFile } from './detect';
import { argbToHex, backupIds, parseSqliteBackup } from './sqliteBackup';
import { summarizePlan, type ImportPlan } from './types';
import { applyImportPlan } from './apply';
import { loadSqlJsForTests } from '../../tests/sqljs';
import { makeBackupDb } from '../../tests/makeBackupDb';
import { setupTestRepos } from '../../tests/helpers';

const TZ = 'Asia/Bishkek';
let SQL: SqlJsStatic;
let bytes: Uint8Array;
let plan: ImportPlan;

beforeAll(async () => {
  SQL = await loadSqlJsForTests();
  bytes = makeBackupDb(SQL);
  plan = parseSqliteBackup(SQL, bytes, { currency: 'KGS', now: 1 });
});

const tx = (id: number) => plan.transactions.find((t) => t.id === backupIds.transaction(id));
const entity = (id: number) => backupIds.entity(id);
const cat = (id: number) => plan.categories.find((c) => c.id === entity(id));
const acc = (id: number) => plan.accounts.find((a) => a.id === entity(id));
const ordered = (kind: 'expense' | 'income', p: ImportPlan = plan, parent?: number) =>
  p.categories
    .filter((c) => c.kind === kind && c.parentId === (parent ? entity(parent) : undefined))
    .sort((a, b) => a.order - b.order)
    .map((c) => c.name);

describe('определение формата', () => {
  it('узнаёт SQLite по заголовку, а не по имени', () => {
    expect(isSqlite(bytes)).toBe(true);
    expect(detectFile(bytes).kind).toBe('sqlite');
    expect(isSqlite(new TextEncoder().encode('SQLite format 2 и прочее'))).toBe(false);
    expect(detectFile(new TextEncoder().encode('Дата;Сумма\n01.01.2026;5')).kind).toBe('csv');
    expect(detectFile(new Uint8Array([1, 0, 2, 3])).kind).toBe('unknown');
  });
});

describe('импорт резервной копии SQLite', () => {
  it('берёт только операции последнего снимка', () => {
    expect(plan.errors).toEqual([]);
    expect(plan.warnings).toEqual([]);
    expect(plan.transactions.map((t) => t.id).sort()).toEqual(
      [101, 102, 103, 104, 105, 106, 107, 108].map(backupIds.transaction).sort(),
    );
    expect(tx(100)).toBeUndefined();
  });

  it('не тянет записи из старых снимков (удалённые счета и категории прошлых установок)', () => {
    const names = [...plan.accounts, ...plan.categories].map((x) => x.name);
    for (const gone of ['Card', 'Groceries', 'Salary', 'Наличка', 'All accounts']) {
      expect(names).not.toContain(gone);
    }
  });

  it('счета — строки с начальным балансом, балансы сходятся с исходным приложением', () => {
    expect(plan.accounts.map((a) => [a.name, a.kind, a.initialBalance])).toEqual([
      ['Карта', 'card', -2875],
      ['Копилка', 'savings', 77900],
    ]);
    const balances = computeBalances(plan.accounts, plan.transactions);
    expect(balances.get(entity(1))).toBe(-191050);
    expect(balances.get(entity(2))).toBe(69900);
  });

  it('категории доходов (тоже _ty = 0) не путаются со счетами', () => {
    expect(ordered('income')).toEqual(['Зарплата', 'Другое']);
    expect(plan.categories).toHaveLength(9);
  });

  it('подкатегории привязаны к родителю, порядок и архив сохраняются', () => {
    expect(ordered('expense')).toEqual([
      'Транспорт и такси',
      'Еда и продукты',
      'Другое',
      'Подарки',
    ]);
    expect(ordered('expense', plan, 10)).toEqual(['Вне дома', 'Дома']);
    expect(ordered('expense', plan, 13)).toEqual(['Такси']);
    expect(cat(12)?.archived).toBe(true);
    expect(cat(15)?.archived).toBe(true);
    expect(cat(13)?.name).toBe('Транспорт и такси');
  });

  it('цвета берутся из копии', () => {
    expect(argbToHex(-10720320)).toBe('#5c6bc0');
    expect(acc(1)?.color).toBe('#5c6bc0');
    expect(cat(10)?.color).toBe('#42a5f5');
    expect(cat(14)?.icon).toBe('car');
  });

  it('операции: суммы строкой в минимальные единицы, подкатегории, возвраты', () => {
    expect(tx(101)).toMatchObject({
      type: 'expense',
      amount: 7675,
      categoryId: entity(10),
      note: 'Рынок',
    });
    expect(tx(102)).toMatchObject({ amount: 286450, categoryId: entity(11) });
    expect(tx(107)).toMatchObject({ accountId: entity(2), categoryId: entity(14) });
    expect(tx(104)).toMatchObject({ type: 'income', amount: 120000, categoryId: entity(20) });
    expect(tx(105)).toMatchObject({ type: 'income', amount: -15050, isRefund: true });
  });

  it('перевод: _a_i — источник, _d_i — получатель', () => {
    expect(tx(103)).toMatchObject({
      type: 'transfer',
      accountId: entity(2),
      toAccountId: entity(1),
      amount: 5000,
      isRefund: false,
    });
    expect(tx(103)?.categoryId).toBeUndefined();
    expect(tx(103)?.toAmount).toBeUndefined();
  });

  it('даты в мс Unix, дни — в поясе пользователя', () => {
    expect(tx(107)?.date).toBe(Date.parse('2026-03-30T18:30:00Z'));
    expect(dayKey(tx(107)!.date, TZ)).toBe('2026-03-31');
  });

  it('валюта — выбранная пользователем', () => {
    const usd = parseSqliteBackup(SQL, bytes, { currency: 'USD' });
    expect(new Set(usd.accounts.map((a) => a.currency))).toEqual(new Set(['USD']));
    expect(new Set(plan.transactions.map((t) => t.currency))).toEqual(new Set(['KGS']));
  });

  it('без таблицы порядка — сортировка по названию', () => {
    const p = parseSqliteBackup(SQL, makeBackupDb(SQL, { withBu: false }), { currency: 'KGS' });
    expect(ordered('expense', p)).toEqual([
      'Другое',
      'Еда и продукты',
      'Подарки',
      'Транспорт и такси',
    ]);
  });

  it('сводка перед импортом', () => {
    const s = summarizePlan(plan);
    expect(s).toMatchObject({
      transactions: 8,
      expenses: 4,
      incomes: 2,
      transfers: 2,
      refunds: 1,
      accounts: 2,
      categories: 9,
      hiddenCategories: 2,
      currencies: ['KGS'],
    });
    expect(dayKey(s.from!, TZ)).toBe('2026-01-10');
    expect(dayKey(s.to!, TZ)).toBe('2026-03-31');
  });

  it('не изменяет исходный файл', () => {
    const copy = new Uint8Array(bytes);
    parseSqliteBackup(SQL, bytes, { currency: 'KGS' });
    expect(bytes).toEqual(copy);
  });

  it('не принимает базу без нужных таблиц', () => {
    const db = new SQL.Database();
    db.run('CREATE TABLE other (x INTEGER)');
    const p = parseSqliteBackup(SQL, db.export(), { currency: 'KGS' });
    db.close();
    expect(p.errors[0].message).toMatch(/нет таблицы/);
    expect(p.transactions).toEqual([]);
  });

  it('повторный импорт обновляет записи, а не дублирует', async () => {
    const { repos } = await setupTestRepos();
    await applyImportPlan(plan, repos);
    await applyImportPlan(parseSqliteBackup(SQL, bytes, { currency: 'KGS' }), repos);
    expect(await repos.transactions.getAll()).toHaveLength(8);
    expect(await repos.accounts.getAll()).toHaveLength(2);
    expect(await repos.categories.getAll()).toHaveLength(9);
  });
});

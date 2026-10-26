import type { SqlJsStatic } from 'sql.js';
import { dayKey } from '../domain/dates';
import { isSqlite, detectFile } from './detect';
import { oneMoneyIds, parseOneMoneyBackup } from './oneMoneyBackup';
import { summarizePlan, type ImportPlan } from './types';
import { applyImportPlan } from './apply';
import { loadSqlJsForTests } from '../../tests/sqljs';
import { makeOneMoneyDb } from '../../tests/makeOneMoneyDb';
import { setupTestRepos } from '../../tests/helpers';

const TZ = 'Asia/Bishkek';
let SQL: SqlJsStatic;
let bytes: Uint8Array;
let plan: ImportPlan;

beforeAll(async () => {
  SQL = await loadSqlJsForTests();
  bytes = makeOneMoneyDb(SQL);
  plan = parseOneMoneyBackup(SQL, bytes, { currency: 'KGS', now: 1 });
});

const tx = (id: number) => plan.transactions.find((t) => t.id === oneMoneyIds.transaction(id));
const entity = (id: number) => oneMoneyIds.entity(id);

describe('определение формата', () => {
  it('узнаёт SQLite по заголовку, а не по имени', () => {
    expect(isSqlite(bytes)).toBe(true);
    expect(detectFile(bytes).kind).toBe('sqlite');
    expect(isSqlite(new TextEncoder().encode('SQLite format 2 и прочее'))).toBe(false);
    expect(detectFile(new TextEncoder().encode('Дата;Сумма\n01.01.2026;5')).kind).toBe('csv');
    expect(detectFile(new Uint8Array([1, 0, 2, 3])).kind).toBe('unknown');
  });
});

describe('импорт резервной копии 1Money', () => {
  it('берёт только операции последнего снимка', () => {
    expect(plan.errors).toEqual([]);
    expect(plan.transactions.map((t) => t.id).sort()).toEqual(
      [101, 102, 103, 104, 105, 106, 107].map(oneMoneyIds.transaction).sort(),
    );
    expect(tx(100)).toBeUndefined();
  });

  it('определяет счета и категории по ссылкам из операций', () => {
    const accounts = plan.accounts.map((a) => a.name).sort();
    expect(accounts).toEqual(['Карта Mbank', 'Накопления', 'Наличные']);
    const expense = plan.categories.filter((c) => c.kind === 'expense').map((c) => c.name);
    const income = plan.categories.filter((c) => c.kind === 'income').map((c) => c.name);
    expect(expense.sort()).toEqual(['Кафе', 'Подарки', 'Продукты', 'Табак', 'Транспорт']);
    expect(income).toEqual(['Зарплата']);
    expect(plan.categories.some((c) => c.name === 'All accounts')).toBe(false);
    expect(plan.accounts.some((a) => a.name === 'All accounts')).toBe(false);
  });

  it('берёт последнюю версию строки de, архивные импортирует скрытыми', () => {
    const cafe = plan.categories.find((c) => c.id === entity(11));
    expect(cafe?.name).toBe('Кафе');
    const tobacco = plan.categories.find((c) => c.id === entity(13));
    expect(tobacco).toMatchObject({ name: 'Табак', archived: true });
    expect(plan.accounts.find((a) => a.id === entity(2))?.kind).toBe('card');
  });

  it('парсит суммы строкой в минимальные единицы', () => {
    expect(tx(101)).toMatchObject({
      type: 'expense',
      amount: 7675,
      isRefund: false,
      note: 'Рынок',
    });
    expect(tx(102)?.amount).toBe(286450);
    expect(tx(104)).toMatchObject({ type: 'income', amount: 12000000, categoryId: entity(20) });
  });

  it('отрицательную сумму сохраняет как возврат', () => {
    expect(tx(105)).toMatchObject({ type: 'expense', amount: -15050, isRefund: true });
  });

  it('перевод: _a_i — источник, _d_i — получатель', () => {
    expect(tx(103)).toMatchObject({
      type: 'transfer',
      accountId: entity(2),
      toAccountId: entity(1),
      amount: 500000,
    });
    expect(tx(103)?.categoryId).toBeUndefined();
  });

  it('даты в мс Unix, дни — в поясе пользователя', () => {
    expect(tx(107)?.date).toBe(Date.parse('2026-03-30T18:30:00Z'));
    expect(dayKey(tx(107)!.date, TZ)).toBe('2026-03-31');
  });

  it('валюта — выбранная пользователем', () => {
    expect(new Set(plan.transactions.map((t) => t.currency))).toEqual(new Set(['KGS']));
    const usd = parseOneMoneyBackup(SQL, bytes, { currency: 'USD' });
    expect(new Set(usd.accounts.map((a) => a.currency))).toEqual(new Set(['USD']));
  });

  it('порядок категорий из bu последнего снимка', () => {
    const expense = plan.categories
      .filter((c) => c.kind === 'expense')
      .sort((a, b) => a.order - b.order)
      .map((c) => c.name);
    expect(expense).toEqual(['Транспорт', 'Кафе', 'Продукты', 'Подарки', 'Табак']);
  });

  it('без связи bu → сортировка по названию и предупреждение', () => {
    const p = parseOneMoneyBackup(SQL, makeOneMoneyDb(SQL, { withBuLink: false }), {
      currency: 'KGS',
    });
    expect(p.warnings.some((w) => w.includes('bu'))).toBe(true);
    const expense = p.categories
      .filter((c) => c.kind === 'expense')
      .sort((a, b) => a.order - b.order)
      .map((c) => c.name);
    expect(expense).toEqual(['Кафе', 'Подарки', 'Продукты', 'Табак', 'Транспорт']);
  });

  it('сводка перед импортом', () => {
    const s = summarizePlan(plan);
    expect(s).toMatchObject({
      transactions: 7,
      expenses: 5,
      incomes: 1,
      transfers: 1,
      refunds: 1,
      accounts: 3,
      categories: 6,
      hiddenCategories: 1,
      currencies: ['KGS'],
    });
    expect(dayKey(s.from!, TZ)).toBe('2026-01-10');
    expect(dayKey(s.to!, TZ)).toBe('2026-03-31');
  });

  it('не изменяет исходный файл', () => {
    const copy = new Uint8Array(bytes);
    parseOneMoneyBackup(SQL, bytes, { currency: 'KGS' });
    expect(bytes).toEqual(copy);
  });

  it('не принимает базу без нужных таблиц', () => {
    const db = new SQL.Database();
    db.run('CREATE TABLE other (x INTEGER)');
    const p = parseOneMoneyBackup(SQL, db.export(), { currency: 'KGS' });
    db.close();
    expect(p.errors[0].message).toMatch(/нет таблицы/);
    expect(p.transactions).toEqual([]);
  });

  it('повторный импорт обновляет записи, а не дублирует', async () => {
    const { repos } = await setupTestRepos();
    await applyImportPlan(plan, repos);
    await applyImportPlan(parseOneMoneyBackup(SQL, bytes, { currency: 'KGS' }), repos);
    expect(await repos.transactions.getAll()).toHaveLength(7);
    expect(await repos.accounts.getAll()).toHaveLength(3);
    expect(await repos.categories.getAll()).toHaveLength(6);
  });
});

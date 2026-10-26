import { budgetStatus, budgetsAffectedBy, categoryWithChildren } from './budgets';
import { dayKey } from './dates';
import { dueOccurrences, nextOccurrenceAfter, occurrenceAt } from './recurrence';
import type { Budget, Category, RecurringRule } from './types';
import { makeTx } from '../../tests/helpers';

const TZ = 'Asia/Bishkek';
// 31 января 2026, 10:00 в Бишкеке
const JAN31 = Date.parse('2026-01-31T04:00:00Z');

const rule = (p: Partial<RecurringRule>): RecurringRule => ({
  id: 'r',
  name: 'Аренда',
  template: {
    type: 'expense',
    accountId: 'a',
    categoryId: 'home',
    amount: 2500000,
    currency: 'KGS',
    note: '',
    tags: [],
  },
  freq: 'month',
  interval: 1,
  startDate: JAN31,
  nextDate: JAN31,
  mode: 'auto',
  active: true,
  createdAt: 0,
  updatedAt: 0,
  ...p,
});

describe('повторения', () => {
  it('ежемесячно 31-го: конец февраля, затем снова 31-е', () => {
    const r = rule({});
    const keys = [0, 1, 2, 3].map((n) => dayKey(occurrenceAt(r, n, TZ), TZ));
    expect(keys).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
    // Время суток сохраняется в поясе пользователя.
    expect(occurrenceAt(r, 1, TZ)).toBe(Date.parse('2026-02-28T04:00:00Z'));
  });

  it('ежегодно 29 февраля в високосный год', () => {
    const start = Date.parse('2028-02-29T04:00:00Z');
    const r = rule({ freq: 'year', startDate: start, nextDate: start });
    expect([1, 4].map((n) => dayKey(occurrenceAt(r, n, TZ), TZ))).toEqual([
      '2029-02-28',
      '2032-02-29',
    ]);
  });

  it('интервал и еженедельный повтор', () => {
    const r = rule({ freq: 'week', interval: 2 });
    expect(dayKey(occurrenceAt(r, 1, TZ), TZ)).toBe('2026-02-14');
  });

  it('следующее повторение и окончание правила', () => {
    const r = rule({ endDate: Date.parse('2026-03-31T18:00:00Z') });
    expect(dayKey(nextOccurrenceAfter(r, JAN31, TZ)!, TZ)).toBe('2026-02-28');
    expect(nextOccurrenceAfter(r, Date.parse('2026-04-01T00:00:00Z'), TZ)).toBeNull();
  });

  it('наступившие повторения до текущего момента', () => {
    const now = Date.parse('2026-04-15T00:00:00Z');
    const dates = dueOccurrences(rule({}), now, TZ).map((d) => dayKey(d, TZ));
    expect(dates).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
    expect(dueOccurrences(rule({ active: false }), now, TZ)).toEqual([]);
  });
});

describe('бюджеты', () => {
  const cats: Category[] = [
    {
      id: 'food',
      name: 'Еда',
      kind: 'expense',
      color: '',
      icon: '',
      archived: false,
      order: 0,
      createdAt: 0,
      updatedAt: 0,
    },
    {
      id: 'cafe',
      name: 'Кафе',
      kind: 'expense',
      parentId: 'food',
      color: '',
      icon: '',
      archived: false,
      order: 0,
      createdAt: 0,
      updatedAt: 0,
    },
    {
      id: 'taxi',
      name: 'Такси',
      kind: 'expense',
      color: '',
      icon: '',
      archived: false,
      order: 0,
      createdAt: 0,
      updatedAt: 0,
    },
  ];
  const budget = (p: Partial<Budget>): Budget => ({
    id: 'b',
    categoryId: 'food',
    period: 'month',
    limit: 10000,
    currency: 'KGS',
    startMonth: '2026-01',
    createdAt: 0,
    updatedAt: 0,
    ...p,
  });
  const oct = (day: number) => Date.parse(`2026-10-${String(day).padStart(2, '0')}T06:00:00Z`);
  const txs = [
    makeTx({ categoryId: 'food', amount: 5000, date: oct(1) }),
    makeTx({ categoryId: 'cafe', amount: 3500, date: oct(2) }),
    makeTx({ categoryId: 'taxi', amount: 4000, date: oct(3) }),
    makeTx({ categoryId: 'food', amount: 9999, date: Date.parse('2026-09-30T17:00:00Z') }), // 30 сен 23:00
    makeTx({ categoryId: 'food', amount: 7777, currency: 'USD', date: oct(4) }),
    makeTx({ type: 'income', categoryId: 'food', amount: 50000, date: oct(5) }),
  ];

  it('считает категорию с подкатегориями в месяце пользователя', () => {
    expect([...categoryWithChildren('food', cats)].sort()).toEqual(['cafe', 'food']);
    const s = budgetStatus(budget({}), '2026-10', txs, cats, TZ);
    expect(s).toMatchObject({ spent: 8500, level: 'warning' });
    expect(s.ratio).toBeCloseTo(0.85);
  });

  it('общий бюджет и превышение', () => {
    const s = budgetStatus(budget({ categoryId: null }), '2026-10', txs, cats, TZ);
    expect(s).toMatchObject({ spent: 12500, level: 'over' });
  });

  it('какие бюджеты затрагивает операция', () => {
    const all = [
      budget({ id: '1' }),
      budget({ id: '2', categoryId: null }),
      budget({ id: '3', categoryId: 'taxi' }),
    ];
    expect(budgetsAffectedBy(makeTx({ categoryId: 'cafe' }), all, cats).map((b) => b.id)).toEqual([
      '1',
      '2',
    ]);
    expect(budgetsAffectedBy(makeTx({ type: 'income', categoryId: 'cafe' }), all, cats)).toEqual(
      [],
    );
  });
});

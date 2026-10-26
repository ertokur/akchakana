import { periodFor } from './dates';
import { changePercent, foldSmallSlices, seriesByBucket, totalsByCategory } from './stats';
import type { Category } from './types';
import { makeTx } from '../../tests/helpers';

const TZ = 'Asia/Bishkek';
const cat = (id: string, parentId?: string, kind: Category['kind'] = 'expense'): Category => ({
  id,
  name: id,
  kind,
  parentId,
  color: '#000',
  icon: 'tag',
  archived: false,
  order: 0,
  createdAt: 0,
  updatedAt: 0,
});

describe('статистика', () => {
  const cats = [cat('food'), cat('cafe', 'food'), cat('taxi'), cat('salary', undefined, 'income')];
  const txs = [
    makeTx({ categoryId: 'food', amount: 1000 }),
    makeTx({ categoryId: 'cafe', amount: 500 }),
    makeTx({ categoryId: 'taxi', amount: 300 }),
    makeTx({ categoryId: 'taxi', amount: -300, isRefund: true }),
    makeTx({ categoryId: 'food', amount: 999, currency: 'USD' }),
    makeTx({ type: 'income', categoryId: 'salary', amount: 50000 }),
    makeTx({ type: 'transfer', amount: 7777 }),
  ];

  it('сворачивает подкатегории в родителя и учитывает возвраты', () => {
    const slices = totalsByCategory(txs, cats, 'expense', 'KGS');
    expect(slices.map((s) => [s.categoryId, s.amount])).toEqual([['food', 1500]]);
    expect(totalsByCategory(txs, cats, 'income', 'KGS')[0].amount).toBe(50000);
  });

  it('раскрывает подкатегории родителя', () => {
    const slices = totalsByCategory(txs, cats, 'expense', 'KGS', { parentId: 'food' });
    expect(slices.map((s) => [s.categoryId, s.amount])).toEqual([
      ['food', 1000],
      ['cafe', 500],
    ]);
    expect(slices[0].name).toBe('food (без подкатегории)');
  });

  it('сворачивает хвост в «Остальное»', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      categoryId: `c${i}`,
      name: `c${i}`,
      color: '#000',
      icon: 'tag',
      amount: 100 - i,
    }));
    const folded = foldSmallSlices(many, 8);
    expect(folded).toHaveLength(8);
    expect(folded[7]).toMatchObject({ name: 'Остальное', amount: 93 + 92 + 91 });
  });

  it('ряды по дням и месяцам в поясе пользователя', () => {
    const month = periodFor('month', Date.parse('2026-10-15T06:00:00Z'), {
      timeZone: TZ,
      weekStartsOn: 1,
    });
    const data = [
      makeTx({ date: Date.parse('2026-09-30T19:00:00Z'), amount: 100 }), // 1 октября 01:00
      makeTx({ date: Date.parse('2026-10-31T17:59:00Z'), type: 'income', amount: 200 }),
      makeTx({ date: Date.parse('2026-10-31T18:00:00Z'), amount: 999 }), // уже ноябрь
    ];
    const days = seriesByBucket(data, month, TZ, 'KGS');
    expect(days).toHaveLength(31);
    expect(days[0]).toEqual({ key: '2026-10-01', income: 0, expense: 100 });
    expect(days[30]).toEqual({ key: '2026-10-31', income: 200, expense: 0 });

    const year = periodFor('year', Date.parse('2026-10-15T06:00:00Z'), {
      timeZone: TZ,
      weekStartsOn: 1,
    });
    const months = seriesByBucket(data, year, TZ, 'KGS');
    expect(months).toHaveLength(12);
    expect(months[9]).toEqual({ key: '2026-10', income: 200, expense: 100 });
    expect(months[10].expense).toBe(999);
  });

  it('изменение к прошлому периоду', () => {
    expect(changePercent(150, 100)).toBe(50);
    expect(changePercent(50, 100)).toBe(-50);
    expect(changePercent(100, 0)).toBeNull();
    expect(changePercent(0, 0)).toBe(0);
    expect(changePercent(1, 3)).toBe(-66.7);
  });
});

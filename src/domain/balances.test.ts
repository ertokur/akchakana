import { computeBalances, summarize, summarizeByCurrency, totalsByCurrency } from './balances';
import { makeAccount } from '../db/seed';
import type { Transaction } from './types';

const tx = (p: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(36),
  type: 'expense',
  accountId: 'a',
  amount: 0,
  isRefund: false,
  currency: 'KGS',
  date: 0,
  note: '',
  tags: [],
  createdAt: 0,
  updatedAt: 0,
  ...p,
});

describe('балансы', () => {
  const cash = makeAccount({ id: 'a', name: 'Наличные', currency: 'KGS', initialBalance: 100000 });
  const card = makeAccount({ id: 'b', name: 'Карта', currency: 'KGS' });
  const usd = makeAccount({ id: 'c', name: 'Доллары', currency: 'USD', initialBalance: 5000 });

  const txs = [
    tx({ type: 'expense', accountId: 'a', amount: 7675 }),
    tx({ type: 'income', accountId: 'b', amount: 5000000 }),
    tx({ type: 'transfer', accountId: 'b', toAccountId: 'a', amount: 1000000 }),
    tx({ type: 'expense', accountId: 'a', amount: -2500, isRefund: true }),
    tx({ type: 'transfer', accountId: 'b', toAccountId: 'c', amount: 870000, toAmount: 10000 }),
  ];

  it('считает начальный баланс, операции, переводы и возвраты', () => {
    const b = computeBalances([cash, card, usd], txs);
    expect(b.get('a')).toBe(100000 - 7675 + 1000000 + 2500);
    expect(b.get('b')).toBe(5000000 - 1000000 - 870000);
    expect(b.get('c')).toBe(15000);
  });

  it('суммирует по валютам без конвертации', () => {
    const b = computeBalances([cash, card, usd], txs);
    const totals = totalsByCurrency([cash, card, usd], b);
    expect(totals.get('KGS')).toBe(b.get('a')! + b.get('b')!);
    expect(totals.get('USD')).toBe(15000);
  });

  it('сводка доходов и расходов без переводов', () => {
    expect(summarize(txs, 'KGS')).toEqual({
      income: 5000000,
      expense: 7675 - 2500,
      balance: 5000000 - 5175,
    });
  });
});

describe('итоги по валютам', () => {
  it('отдельно по каждой валюте, основная первой, переводы не считаются', () => {
    const result = summarizeByCurrency(
      [
        tx({ type: 'expense', amount: 500, currency: 'USD' }),
        tx({ type: 'income', amount: 10000, currency: 'KGS' }),
        tx({ type: 'expense', amount: 3000, currency: 'KGS' }),
        tx({ type: 'transfer', amount: 999, currency: 'EUR' }),
        tx({ type: 'income', amount: 200, currency: 'AED' }),
      ],
      'KGS',
    );
    expect(result.map((r) => r.currency)).toEqual(['KGS', 'AED', 'USD']);
    expect(result[0].summary).toEqual({ income: 10000, expense: 3000, balance: 7000 });
    expect(result[2].summary.balance).toBe(-500);
  });
});

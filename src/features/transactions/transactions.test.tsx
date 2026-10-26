import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../app/App';
import { useData } from '../../stores/dataStore';
import { applyKey } from '../editor/CalcKeypad';
import { filterTransactions, groupByDay } from './grouping';
import { makeTx, seedBasic, setupTestRepos } from '../../../tests/helpers';

const TZ = 'Asia/Bishkek';

describe('группировка по дням', () => {
  it('группирует в поясе пользователя и считает итог дня без переводов', () => {
    const txs = [
      // 26 окт 19:00 UTC = 27 окт 01:00 в Бишкеке
      makeTx({ date: Date.parse('2026-10-26T19:00:00Z'), type: 'expense', amount: 500 }),
      makeTx({ date: Date.parse('2026-10-26T17:00:00Z'), type: 'income', amount: 2000 }),
      makeTx({ date: Date.parse('2026-10-26T16:00:00Z'), type: 'expense', amount: 300 }),
      makeTx({ date: Date.parse('2026-10-26T15:00:00Z'), type: 'transfer', amount: 9999 }),
    ];
    const groups = groupByDay(txs, TZ);
    expect(groups.map((g) => g.key)).toEqual(['2026-10-27', '2026-10-26']);
    expect(groups[0].totals.get('KGS')).toBe(-500);
    expect(groups[1].totals.get('KGS')).toBe(2000 - 300);
    expect(groups[1].items).toHaveLength(3);
  });

  it('фильтр по счёту включает обе стороны перевода', () => {
    const txs = [
      makeTx({ accountId: 'a', date: 10 }),
      makeTx({ accountId: 'b', toAccountId: 'a', type: 'transfer', date: 20 }),
      makeTx({ accountId: 'b', date: 30 }),
    ];
    expect(filterTransactions(txs, 0, 100, 'a')).toHaveLength(2);
    expect(filterTransactions(txs, 0, 25, 'all')).toHaveLength(2);
  });
});

describe('ввод на калькуляторе', () => {
  it.each([
    ['', '5', '5'],
    ['0', '5', '5'],
    ['12', '.', '12.'],
    ['12.5', '.', '12.5'],
    ['12.55', '1', '12.55'],
    ['12', '+', '12+'],
    ['12+', '*', '12*'],
    ['', '+', ''],
    ['', '-', '-'],
    ['', '.', '0.'],
    ['12+', '.', '12+0.'],
    ['', '00', '0'],
    ['5', '00', '500'],
    ['123', 'back', '12'],
    ['123', 'clear', ''],
  ])('«%s» + %s → «%s»', (expr, key, expected) => {
    expect(applyKey(expr, key, 2)).toBe(expected);
  });

  it('валюта без копеек не принимает запятую', () => {
    expect(applyKey('12', '.', 0)).toBe('12');
  });
});

describe('экран операций', () => {
  it('добавляет расход через шторку и показывает его в списке', async () => {
    const { repos } = await setupTestRepos();
    await seedBasic(repos);
    const user = userEvent.setup();
    render(<App />);

    await user.click((await screen.findAllByRole('button', { name: 'Добавить операцию' }))[0]);
    const sheet = await screen.findByRole('dialog', { name: 'Новая операция' });
    await user.click(within(sheet).getByRole('radio', { name: 'Продукты' }));
    const keypad = screen.getByRole('group', { name: 'Калькулятор' });
    for (const k of ['1', '2', '0', 'Плюс', '3', '0']) {
      await user.click(within(keypad).getByRole('button', { name: k }));
    }
    await user.type(within(sheet).getByRole('textbox', { name: 'Заметка' }), 'Рынок');
    await user.click(within(keypad).getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const row = await screen.findByRole('button', { name: /Продукты, −150\u00a0сом, Рынок/ });
    expect(row).toBeInTheDocument();

    const saved = await repos.transactions.getAll();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      type: 'expense',
      amount: 15000,
      note: 'Рынок',
      isRefund: false,
    });
    expect(useData.getState().transactions).toHaveLength(1);
  });

  it('не сохраняет операцию без суммы', async () => {
    const { repos } = await setupTestRepos();
    await seedBasic(repos);
    const user = userEvent.setup();
    render(<App />);
    await user.click((await screen.findAllByRole('button', { name: 'Добавить операцию' }))[0]);
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Введите сумму');
    expect(await repos.transactions.getAll()).toHaveLength(0);
  });

  it('показывает онбординг при первом запуске', async () => {
    await setupTestRepos();
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Первый счёт' })).toBeInTheDocument();
  });
});

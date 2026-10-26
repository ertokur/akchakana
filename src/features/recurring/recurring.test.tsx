import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../app/App';
import { useData } from '../../stores/dataStore';
import type { RecurringRule } from '../../domain/types';
import { seedBasic, setupTestRepos } from '../../../tests/helpers';
import { runScheduler } from './scheduler';

function makeRule(accountId: string, categoryId: string, p: Partial<RecurringRule>): RecurringRule {
  const start = Date.parse('2026-08-15T04:00:00Z');
  return {
    id: 'rule-1',
    name: 'Интернет',
    template: {
      type: 'expense',
      accountId,
      categoryId,
      amount: 90000,
      currency: 'KGS',
      note: '',
      tags: [],
    },
    freq: 'month',
    interval: 1,
    startDate: start,
    nextDate: start,
    mode: 'auto',
    active: true,
    createdAt: 0,
    updatedAt: 0,
    ...p,
  };
}

describe('планировщик повторов', () => {
  it('режим «auto» создаёт пропущенные операции и сдвигает дату', async () => {
    const { repos } = await setupTestRepos();
    const { account } = await seedBasic(repos);
    const cat = (await repos.categories.getAll())[0];
    await repos.recurring.put(makeRule(account.id, cat.id, {}));
    await useData.getState().load();

    const created = await runScheduler(Date.parse('2026-10-20T00:00:00Z'));
    expect(created).toBe(3);
    const txs = await repos.transactions.getAll();
    expect(txs.map((t) => [t.amount, t.note])).toEqual([
      [90000, 'Интернет'],
      [90000, 'Интернет'],
      [90000, 'Интернет'],
    ]);
    const rule = await repos.recurring.get('rule-1');
    expect(rule?.nextDate).toBe(Date.parse('2026-11-15T04:00:00Z'));

    // Повторный запуск в тот же день ничего не дублирует.
    expect(await runScheduler(Date.parse('2026-10-20T00:00:00Z'))).toBe(0);
  });

  it('режим «remind» показывает карточку и добавляет операцию по подтверждению', async () => {
    const { repos } = await setupTestRepos();
    const { account } = await seedBasic(repos);
    const cat = (await repos.categories.getAll())[0];
    await repos.recurring.put(
      makeRule(account.id, cat.id, {
        mode: 'remind',
        startDate: Date.now() - 1000,
        nextDate: Date.now() - 1000,
      }),
    );
    const user = userEvent.setup();
    render(<App />);

    const card = await screen.findByRole('region', { name: 'Регулярные платежи к оплате' });
    expect(card).toHaveTextContent('Интернет');
    await user.click(within(card).getByRole('button', { name: 'Добавить операцию' }));
    await waitFor(async () => expect(await repos.transactions.getAll()).toHaveLength(1));
    const rule = await repos.recurring.get('rule-1');
    expect(rule!.nextDate).toBeGreaterThan(Date.now());
    await waitFor(() =>
      expect(
        screen.queryByRole('region', { name: 'Регулярные платежи к оплате' }),
      ).not.toBeInTheDocument(),
    );
  });
});

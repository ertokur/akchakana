import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../app/App';
import { makeTx, seedBasic, setupTestRepos } from '../../../tests/helpers';

describe('экран обзора', () => {
  afterEach(() => {
    window.location.hash = '';
  });

  it('показывает расходы по категориям и переход в подкатегории', async () => {
    const { repos } = await setupTestRepos();
    const { account } = await seedBasic(repos);
    const cats = await repos.categories.getAll();
    const food = cats.find((c) => c.name === 'Продукты')!;
    const taxi = cats.find((c) => c.name === 'Транспорт')!;
    await repos.categories.put({ ...food, id: 'market', name: 'Рынок', parentId: food.id });
    await repos.transactions.bulkPut([
      makeTx({ accountId: account.id, categoryId: food.id, amount: 30000 }),
      makeTx({ accountId: account.id, categoryId: 'market', amount: 20000 }),
      makeTx({ accountId: account.id, categoryId: taxi.id, amount: 50000 }),
    ]);
    window.location.hash = '#/stats';
    const user = userEvent.setup();
    render(<App />);

    const list = await screen.findByRole('list', { name: 'Категории' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Продукты');
    expect(items[0]).toHaveTextContent('50,0%');

    await user.click(within(list).getByRole('button', { name: 'Продукты: подкатегории' }));
    const sub = await screen.findByRole('list', { name: 'Категории' });
    expect(
      within(sub)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual([
      expect.stringContaining('Продукты (без подкатегории)'),
      expect.stringContaining('Рынок'),
    ]);
  });
});

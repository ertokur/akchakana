import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../app/App';
import { makeAccount } from '../../db/seed';
import { useUi } from '../../stores/uiStore';
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

  it('итоги за всё время: с учётом фильтра счёта и по валютам; переход к периоду «Всё время»', async () => {
    const { repos } = await setupTestRepos();
    const { account } = await seedBasic(repos);
    const usd = makeAccount({ id: 'usd', name: 'Доллары', currency: 'USD' });
    await repos.accounts.put(usd);
    const old = Date.parse('2024-03-10T06:00:00Z');
    await repos.transactions.bulkPut([
      makeTx({ accountId: account.id, amount: 30000, date: old }),
      makeTx({ accountId: account.id, amount: 20000 }),
      makeTx({ accountId: account.id, type: 'income', amount: 100000, date: old }),
      makeTx({ accountId: 'usd', amount: 1500, currency: 'USD', date: old }),
    ]);
    window.location.hash = '#/stats';
    const user = userEvent.setup();
    render(<App />);

    const card = (await screen.findByRole('heading', { name: /За всё время/ })).parentElement!;
    expect(card).toHaveTextContent('с 10 мар. 2024');
    // Валюты не смешиваются: сначала основная (сомы), затем доллары.
    expect(card).toHaveTextContent(/Расходы500\sсомДоходы1\s000\sсомИтого\+500\sсом/);
    expect(card).toHaveTextContent(/Расходы15\s\$Доходы0\s\$Итого−15\s\$/);

    // Фильтр по счёту: доллары исчезают.
    act(() => useUi.getState().setAccountFilter(account.id));
    expect(
      (await screen.findByRole('heading', { name: /За всё время/ })).parentElement,
    ).not.toHaveTextContent('$');

    await user.click(screen.getByRole('button', { name: 'Показать всё время' }));
    expect(useUi.getState().period.kind).toBe('all');
    expect(screen.getByRole('button', { name: /Период: Всё время/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Предыдущий период' })).toBeDisabled();
    // Итоговая карточка не дублируется, вместо сравнения — «с даты».
    expect(screen.queryByRole('heading', { name: /За всё время/ })).not.toBeInTheDocument();
    expect(screen.getAllByText('с 10 мар. 2024')).toHaveLength(2);
  });
});

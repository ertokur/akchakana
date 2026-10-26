import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../app/App';
import { categoryTree, moveCategory } from '../../domain/categories';
import { debtRemaining, debtTotals } from '../../domain/debts';
import type { Category, Debt } from '../../domain/types';
import { seedBasic, setupTestRepos } from '../../../tests/helpers';

const cat = (p: Partial<Category>): Category => ({
  id: 'x',
  name: 'x',
  kind: 'expense',
  color: '#000',
  icon: 'tag',
  archived: false,
  order: 0,
  createdAt: 0,
  updatedAt: 0,
  ...p,
});

describe('порядок категорий', () => {
  const cats = [
    cat({ id: 'a', name: 'А', order: 0 }),
    cat({ id: 'b', name: 'Б', order: 1 }),
    cat({ id: 'c', name: 'В', order: 2 }),
    cat({ id: 'a1', name: 'А1', parentId: 'a', order: 0 }),
    cat({ id: 'a2', name: 'А2', parentId: 'a', order: 1 }),
    cat({ id: 'i', name: 'Доход', kind: 'income', order: 0 }),
  ];

  it('перемещает среди соседей и возвращает только изменённые', () => {
    const changed = moveCategory(cats, 'c', 0, 5);
    expect(changed.map((c) => [c.id, c.order])).toEqual([
      ['c', 0],
      ['a', 1],
      ['b', 2],
    ]);
    expect(changed.every((c) => c.updatedAt === 5)).toBe(true);
  });

  it('подкатегории сортируются внутри родителя', () => {
    expect(moveCategory(cats, 'a2', 0).map((c) => c.id)).toEqual(['a2', 'a1']);
    expect(moveCategory(cats, 'a', 0)).toEqual([]);
    expect(moveCategory(cats, 'a', 99).map((c) => c.id)).toEqual(['b', 'c', 'a']);
  });

  it('строит дерево по типу', () => {
    const tree = categoryTree(cats, 'expense');
    expect(tree.map((n) => n.parent.id)).toEqual(['a', 'b', 'c']);
    expect(tree[0].children.map((c) => c.id)).toEqual(['a1', 'a2']);
    expect(categoryTree(cats, 'income')).toHaveLength(1);
  });
});

describe('долги', () => {
  const debt = (p: Partial<Debt>): Debt => ({
    id: 'd',
    direction: 'owedToMe',
    person: 'Азамат',
    amount: 100000,
    currency: 'KGS',
    note: '',
    settled: false,
    payments: [],
    createdAt: 0,
    updatedAt: 0,
    ...p,
  });

  it('считает остаток и итоги по направлениям', () => {
    const d1 = debt({ payments: [{ date: 1, amount: 30000 }] });
    const d2 = debt({ id: 'e', direction: 'iOwe', amount: 5000 });
    const d3 = debt({ id: 'f', settled: true });
    expect(debtRemaining(d1)).toBe(70000);
    expect(debtRemaining(debt({ payments: [{ date: 1, amount: 200000 }] }))).toBe(0);
    const totals = debtTotals([d1, d2, d3]);
    expect(totals.owedToMe.get('KGS')).toBe(70000);
    expect(totals.iOwe.get('KGS')).toBe(5000);
  });
});

describe('экраны счетов и категорий', () => {
  beforeEach(() => {
    window.location.hash = '';
  });

  it('создаёт счёт и показывает общий баланс', async () => {
    const { repos } = await setupTestRepos();
    await seedBasic(repos);
    window.location.hash = '#/accounts';
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Добавить счёт' }));
    const sheet = await screen.findByRole('dialog', { name: 'Новый счёт' });
    await user.type(within(sheet).getByLabelText('Название'), 'Карта Mbank');
    await user.type(within(sheet).getByLabelText('Начальный баланс'), '2500,50');
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText('Карта Mbank')).toBeInTheDocument();
    // 1000 сом наличными + 2500,50 на карте
    expect(screen.getByText(/^3\s500,50\sсом$/)).toBeInTheDocument();
    const saved = (await repos.accounts.getAll()).find((a) => a.name === 'Карта Mbank');
    expect(saved).toMatchObject({ initialBalance: 250050, kind: 'card', currency: 'KGS' });
  });

  it('скрывает категорию в архив', async () => {
    const { repos } = await setupTestRepos();
    await seedBasic(repos);
    window.location.hash = '#/categories';
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Транспорт' }));
    await user.click(await screen.findByRole('switch', { name: /Скрыть категорию/ }));
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(await screen.findByText('Скрытые (1)')).toBeInTheDocument();
    const transport = (await repos.categories.getAll()).find((c) => c.name === 'Транспорт');
    expect(transport?.archived).toBe(true);
  });
});

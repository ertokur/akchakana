import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../app/App';
import { defaultCategories, missingDefaultSubcategories } from '../../db/seed';
import { useData } from '../../stores/dataStore';
import { makeTx, seedBasic, setupTestRepos } from '../../../tests/helpers';

describe('стандартные подкатегории', () => {
  it('создаются при первом запуске и не дублируются', () => {
    const cats = defaultCategories(0);
    const food = cats.find((c) => c.name === 'Продукты' && !c.parentId)!;
    expect(cats.filter((c) => c.parentId === food.id).map((c) => c.name)).toContain('Рынок');
    expect(missingDefaultSubcategories(cats)).toEqual([]);
  });

  it('добавляются к существующим категориям без подкатегорий', () => {
    const parents = defaultCategories(0).filter((c) => !c.parentId);
    const subs = missingDefaultSubcategories(parents);
    expect(subs.length).toBeGreaterThan(20);
    expect(subs.every((s) => parents.some((p) => p.id === s.parentId))).toBe(true);
  });
});

describe('главный экран с кругом', () => {
  afterEach(() => {
    window.location.hash = '';
  });

  it('показывает расходы по категориям и открывает ввод суммы по нажатию', async () => {
    const { repos } = await setupTestRepos();
    const { account } = await seedBasic(repos);
    const cats = await repos.categories.getAll();
    const transport = cats.find((c) => c.name === 'Транспорт' && !c.parentId)!;
    const taxi = cats.find((c) => c.name === 'Такси')!;
    await repos.transactions.bulkPut([
      makeTx({ accountId: account.id, categoryId: taxi.id, amount: 25000 }),
      makeTx({ accountId: account.id, categoryId: transport.id, amount: 5000 }),
    ]);
    const user = userEvent.setup();
    render(<App />);

    const group = await screen.findByRole('group', { name: 'Категории расходов' });
    // Подкатегория «Такси» учитывается в родителе «Транспорт».
    const bubble = within(group).getByRole('button', { name: /^Транспорт: 300\sсом/ });
    expect(within(group).getByRole('button', { name: /^Расходы 300\sсом/ })).toBeInTheDocument();

    await user.click(bubble);
    const sheet = await screen.findByRole('dialog', { name: 'Новая операция' });
    expect(
      within(sheet).getByRole('button', { name: /В категорию: Транспорт/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Категория расхода' })).not.toBeInTheDocument();
  });

  it('нажатие на круг переключает расходы и доходы', async () => {
    const { repos } = await setupTestRepos();
    await seedBasic(repos);
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /^Расходы .*Показать доходы/ }));
    expect(await screen.findByRole('group', { name: 'Категории доходов' })).toBeInTheDocument();
  });

  it('в режиме изменения открывает категорию с редактором подкатегорий', async () => {
    const { repos } = await setupTestRepos();
    await seedBasic(repos);
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Изменить категории' }));
    await user.click(screen.getByRole('button', { name: /^Продукты:.*Изменить категорию/ }));
    const subs = await screen.findByRole('region', { name: 'Подкатегории' });

    await user.type(within(subs).getByRole('textbox', { name: 'Новая подкатегория' }), 'Мясо');
    await user.click(within(subs).getByRole('button', { name: 'Добавить подкатегорию' }));
    await waitFor(() =>
      expect(useData.getState().categories.some((c) => c.name === 'Мясо' && c.parentId)).toBe(true),
    );

    const rename = within(subs).getByRole('textbox', { name: 'Название подкатегории Рынок' });
    await user.clear(rename);
    await user.type(rename, 'Базар{Enter}');
    await waitFor(async () =>
      expect((await repos.categories.getAll()).some((c) => c.name === 'Базар')).toBe(true),
    );

    await user.click(within(subs).getByRole('button', { name: 'Удалить «Мясо»' }));
    await waitFor(async () =>
      expect((await repos.categories.getAll()).some((c) => c.name === 'Мясо')).toBe(false),
    );
  });
});

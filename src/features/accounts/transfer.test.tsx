import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../app/App';
import { makeAccount } from '../../db/seed';
import { computeBalances } from '../../domain/balances';
import { seedBasic, setupTestRepos } from '../../../tests/helpers';

describe('перевод между счетами', () => {
  afterEach(() => {
    window.location.hash = '';
  });

  it('с карточки счёта: получатель подставляется сам, балансы меняются', async () => {
    const { repos } = await setupTestRepos();
    const { account: cash } = await seedBasic(repos);
    const card = makeAccount({ name: 'Карта', kind: 'card', currency: 'KGS', order: 1 });
    await repos.accounts.put(card);
    window.location.hash = '#/accounts';
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Перевести с «Наличные»' }));
    const sheet = await screen.findByRole('dialog', { name: 'Новая операция' });
    expect(within(sheet).getByRole('radio', { name: 'Перевод' })).toBeChecked();
    expect(within(sheet).getByRole('button', { name: /Со счёта: Наличные/ })).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: /На счёт: Карта/ })).toBeInTheDocument();

    const keypad = screen.getByRole('group', { name: 'Калькулятор' });
    for (const k of ['5', '0', '0'])
      await user.click(within(keypad).getByRole('button', { name: k }));
    await user.click(within(keypad).getByRole('button', { name: 'Сохранить' }));

    await waitFor(async () => expect(await repos.transactions.getAll()).toHaveLength(1));
    const [t] = await repos.transactions.getAll();
    expect(t).toMatchObject({
      type: 'transfer',
      accountId: cash.id,
      toAccountId: card.id,
      amount: 50000,
    });
    const balances = computeBalances(await repos.accounts.getAll(), [t]);
    expect(balances.get(cash.id)).toBe(100000 - 50000);
    expect(balances.get(card.id)).toBe(50000);
  });

  it('общая кнопка при трёх счетах сразу открывает выбор счёта зачисления', async () => {
    const { repos } = await setupTestRepos();
    await seedBasic(repos);
    await repos.accounts.bulkPut([
      makeAccount({ name: 'Карта', kind: 'card', currency: 'KGS', order: 1 }),
      makeAccount({ name: 'Копилка', kind: 'savings', currency: 'KGS', order: 2 }),
    ]);
    window.location.hash = '#/accounts';
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Перевод между счетами' }));
    const picker = await screen.findByRole('dialog', { name: 'На счёт' });
    await user.click(within(picker).getByRole('button', { name: /Копилка/ }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'На счёт' })).not.toBeInTheDocument(),
    );
    const sheet = screen.getByRole('dialog', { name: 'Новая операция' });
    expect(within(sheet).getByRole('button', { name: /На счёт: Копилка/ })).toBeInTheDocument();
  });

  it('с одним счётом кнопок перевода нет', async () => {
    const { repos } = await setupTestRepos();
    await seedBasic(repos);
    window.location.hash = '#/accounts';
    render(<App />);
    await screen.findByRole('heading', { name: 'Счета' });
    expect(screen.queryByRole('button', { name: 'Перевод между счетами' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Перевести с/ })).not.toBeInTheDocument();
  });
});

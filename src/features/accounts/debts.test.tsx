import { render, screen, within } from '@testing-library/react';
import { App } from '../../app/App';
import { debtPaid, debtTotals, isDebtOverdue, sortDebts } from '../../domain/debts';
import type { Debt } from '../../domain/types';
import { setLanguage } from '../../i18n';
import { seedBasic, setupTestRepos } from '../../../tests/helpers';

const DAY = 86_400_000;
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

describe('долги: расчёты', () => {
  const now = 100 * DAY;

  it('просрочен только открытый долг с остатком и прошедшим сроком', () => {
    expect(isDebtOverdue(debt({ dueDate: now - DAY }), now)).toBe(true);
    expect(isDebtOverdue(debt({ dueDate: now + DAY }), now)).toBe(false);
    expect(isDebtOverdue(debt({}), now)).toBe(false);
    expect(isDebtOverdue(debt({ dueDate: now - DAY, settled: true }), now)).toBe(false);
    const paidOff = debt({ dueDate: now - DAY, payments: [{ date: 1, amount: 100000 }] });
    expect(isDebtOverdue(paidOff, now)).toBe(false);
    expect(debtPaid(paidOff)).toBe(100000);
  });

  it('итоги без нулевых остатков; порядок: ближайший срок, без срока в конце, закрытые — свежие сверху', () => {
    const paidOff = debt({ id: 'p', payments: [{ date: 1, amount: 100000 }] });
    const totals = debtTotals([paidOff]);
    expect(totals.owedToMe.size).toBe(0);

    const { open, settled } = sortDebts([
      debt({ id: 'none-old', createdAt: 1 }),
      debt({ id: 'late', dueDate: 50 * DAY }),
      debt({ id: 'none-new', createdAt: 5 }),
      debt({ id: 'soon', dueDate: 10 * DAY }),
      debt({ id: 's1', settled: true, updatedAt: 1 }),
      debt({ id: 's2', settled: true, updatedAt: 9 }),
    ]);
    expect(open.map((d) => d.id)).toEqual(['soon', 'late', 'none-new', 'none-old']);
    expect(settled.map((d) => d.id)).toEqual(['s2', 's1']);
  });
});

describe('экран долгов', () => {
  afterEach(() => {
    window.location.hash = '';
    setLanguage('ru');
  });

  async function renderDebts(debts: Debt[]) {
    const { repos } = await setupTestRepos();
    await seedBasic(repos);
    await repos.debts.bulkPut(debts);
    window.location.hash = '#/debts';
    render(<App />);
    await screen.findByRole('heading', { name: 'Долги' });
  }

  const sample = (now: number) => [
    debt({
      id: 'a',
      person: 'Азамат',
      amount: 500000,
      payments: [{ date: now - 5 * DAY, amount: 200000 }],
      dueDate: now - 3 * DAY,
    }),
    debt({ id: 'b', direction: 'iOwe', person: 'Банк', amount: 100000, currency: 'USD' }),
    debt({
      id: 'c',
      person: 'Бакыт',
      amount: 300000,
      payments: [{ date: now - DAY, amount: 300000 }],
      settled: true,
    }),
  ];

  it('итоги подписаны, остаток показан «из» суммы, просрочка выделена', async () => {
    const now = Date.now();
    await renderDebts(sample(now));
    // Раньше вместо подписей выводились ключи словаря.
    expect(screen.queryByText(/debt\./)).not.toBeInTheDocument();
    expect(screen.getAllByText('Мне должны').length).toBeGreaterThan(1);
    expect(screen.getAllByText('Я должен').length).toBeGreaterThan(1);

    const azamat = screen.getByRole('button', { name: /^Азамат/ });
    expect(azamat).toHaveTextContent(/3\s000\sсом/);
    expect(azamat).toHaveTextContent(/из 5\s000\sсом/);
    expect(within(azamat).getByText(/^просрочен:/)).toHaveClass('text-expense');

    // Закрытый долг — исходная сумма, а не «0».
    const bakyt = screen.getByRole('button', { name: /^Бакыт/ });
    expect(bakyt).toHaveTextContent(/3\s000\sсом/);
    expect(bakyt).not.toHaveTextContent(/^0/);
  });

  it('на английском тоже переведено', async () => {
    setLanguage('en');
    const { repos } = await setupTestRepos();
    await seedBasic(repos);
    await repos.settings.update({ language: 'en' });
    await repos.debts.bulkPut(sample(Date.now()));
    window.location.hash = '#/debts';
    render(<App />);
    await screen.findByRole('heading', { name: 'Debts' });
    expect(screen.queryByText(/debt\./)).not.toBeInTheDocument();
    expect(screen.getAllByText('Owed to me').length).toBeGreaterThan(1);
    expect(screen.getByText(/^overdue:/)).toBeInTheDocument();
  });
});

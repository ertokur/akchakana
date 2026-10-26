import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../app/App';
import { makeAccount } from '../../db/seed';
import { buildOwnCsv } from '../../exporters/ownCsv';
import { useData } from '../../stores/dataStore';
import { makeTx, setupTestRepos } from '../../../tests/helpers';
import { shouldRemindExport } from './ExportReminder';

describe('экран импорта', () => {
  afterEach(() => {
    window.location.hash = '';
  });

  it('из онбординга: показывает сводку и импортирует только после подтверждения', async () => {
    const { repos } = await setupTestRepos();
    const account = makeAccount({ id: 'a1', name: 'Кошелёк', currency: 'KGS' }, 1);
    const csv = buildOwnCsv(
      {
        accounts: [account],
        categories: [],
        transactions: [
          makeTx({
            id: 't1',
            accountId: 'a1',
            amount: 5000,
            date: Date.parse('2026-03-01T06:00:00Z'),
            createdAt: 1,
            updatedAt: 1,
          }),
          makeTx({
            id: 't2',
            type: 'income',
            accountId: 'a1',
            amount: 9000,
            date: Date.parse('2026-03-09T06:00:00Z'),
            createdAt: 1,
            updatedAt: 1,
          }),
        ],
        budgets: [],
        recurring: [],
        debts: [],
      },
      'Asia/Bishkek',
    );
    window.location.hash = '#/settings/import';
    const user = userEvent.setup();
    render(<App />);

    const input = await screen.findByLabelText(/Выбрать файл/);
    // Имя без расширения: формат определяется по содержимому.
    await user.upload(input, new File([csv], 'backup', { type: '' }));

    expect(await screen.findByText('Файл этого приложения')).toBeInTheDocument();
    expect(screen.getByText('Операций').nextElementSibling).toHaveTextContent('2');
    expect(screen.getByText('Период').nextElementSibling).toHaveTextContent(
      '1 мар. 2026 — 9 мар. 2026',
    );
    expect(await repos.transactions.getAll()).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Импортировать' }));
    await waitFor(() => expect(useData.getState().transactions).toHaveLength(2));
    expect((await repos.settings.get()).onboarded).toBe(true);
    expect(await screen.findByRole('heading', { name: 'Операции' })).toBeInTheDocument();
  });

  it('сообщает о непонятном файле', async () => {
    await setupTestRepos();
    window.location.hash = '#/settings/import';
    const user = userEvent.setup();
    render(<App />);
    const input = await screen.findByLabelText(/Выбрать файл/);
    await user.upload(input, new File([new Uint8Array([0, 1, 2, 0, 5])], 'x.bin'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/не похож/);
  });
});

describe('напоминание об экспорте', () => {
  const day = 86_400_000;
  it('раз в 30 дней с последнего экспорта или первой записи', () => {
    expect(shouldRemindExport(undefined, undefined, undefined, 100 * day)).toBe(false);
    expect(shouldRemindExport(undefined, undefined, 60 * day, 100 * day)).toBe(true);
    expect(shouldRemindExport(80 * day, undefined, 0, 100 * day)).toBe(false);
    expect(shouldRemindExport(60 * day, undefined, 0, 100 * day)).toBe(true);
    expect(shouldRemindExport(60 * day, 101 * day, 0, 100 * day)).toBe(false);
  });
});

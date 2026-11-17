import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../app/App';
import { useData } from '../../stores/dataStore';
import { useUi } from '../../stores/uiStore';
import { setupTestRepos } from '../../../tests/helpers';
import { makeBackupDb } from '../../../tests/makeBackupDb';
import { loadSqlJsForTests } from '../../../tests/sqljs';

// В браузере wasm берётся из бандла; в тестах — с диска.
vi.mock('../../importers/sqlLoader', () => ({ loadSqlJs: () => loadSqlJsForTests() }));

/**
 * Регрессия: после импорта резервной копии пользователь видел только операции текущего месяца
 * (период по умолчанию) и думал, что импорт потерял данные. Теперь после импорта истории
 * включается период «Всё время», и на экранах видны все операции из файла.
 */
describe('импорт резервной копии SQLite в интерфейсе', () => {
  afterEach(() => {
    window.location.hash = '';
  });

  it('после импорта видны все операции, в том числе старые и в скрытых категориях', async () => {
    const { repos } = await setupTestRepos();
    const SQL = await loadSqlJsForTests();
    const bytes = makeBackupDb(SQL);
    window.location.hash = '#/settings/import';
    const user = userEvent.setup();
    render(<App />);

    const input = await screen.findByLabelText(/Выбрать файл/);
    await user.upload(input, new File([bytes as BlobPart], 'backup', { type: '' }));
    expect(await screen.findByText('Операций')).toBeInTheDocument();
    expect(screen.getByText('Операций').nextElementSibling).toHaveTextContent('8');

    await user.click(screen.getByRole('button', { name: 'Импортировать' }));
    await waitFor(() => expect(useData.getState().transactions).toHaveLength(8));
    expect(await repos.transactions.getAll()).toHaveLength(8);
    // Операции в файле — январь–март 2026, не текущий месяц: включён период «Всё время».
    await waitFor(() => expect(useUi.getState().period.kind).toBe('all'));

    // Главный экран: скрытая категория «Подарки» с операцией за период тоже на экране,
    // сумма в круге сходится с кружками. Расходы: 76,75 + 2864,5 + 30 + 40 = 3011,25.
    const group = await screen.findByRole('group', { name: 'Категории расходов' });
    expect(within(group).getByRole('button', { name: /^Расходы 3\s011,25\sсом/ })).toBeVisible();
    expect(within(group).getByRole('button', { name: /^Подарки: 30\sсом/ })).toBeVisible();

    // Экран операций: все 8 строк.
    window.location.hash = '#/transactions';
    await screen.findByRole('heading', { name: 'Операции' });
    await waitFor(() => expect(document.querySelectorAll('li[data-swipe-ignore]')).toHaveLength(8));
    expect(screen.getByRole('button', { name: /Период: Всё время/ })).toBeInTheDocument();
  });
});

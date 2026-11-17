import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../app/App';
import { useData } from '../../stores/dataStore';
import { setupTestRepos } from '../../../tests/helpers';

describe('знакомство с приложением', () => {
  afterEach(() => {
    window.location.hash = '';
  });

  it('начинается с логотипа, описания и подписи авторов', async () => {
    await setupTestRepos();
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Акчакана', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Логотип Акчакана' })).toBeInTheDocument();
    expect(
      screen.getByRole('note', { name: /Made by Erbol Tokur and Claude/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Первый счёт' })).not.toBeInTheDocument();
  });

  it('пошагово показывает функции, затем создание счёта и импорт', async () => {
    const { repos } = await setupTestRepos();
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Познакомиться' }));
    expect(screen.getByRole('heading', { name: 'Все расходы на одном круге' })).toBeInTheDocument();
    for (const title of [
      'Трата за два касания',
      'Счета, переводы и бюджеты',
      'Понятная статистика',
      'Ваши данные — только у вас',
    ]) {
      await user.click(screen.getByRole('button', { name: 'Далее' }));
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    }
    // Назад и вперёд по шагам.
    await user.click(screen.getByRole('button', { name: 'Назад' }));
    expect(screen.getByRole('heading', { name: 'Понятная статистика' })).toBeInTheDocument();
    await user.keyboard('{ArrowRight}');
    await user.click(screen.getByRole('button', { name: 'Начать' }));

    expect(screen.getByRole('heading', { name: 'Первый счёт' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Импортировать данные' })).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Текущий баланс'));
    await user.type(screen.getByLabelText('Текущий баланс'), '1500');
    await user.click(screen.getByRole('button', { name: 'Создать счёт и начать' }));
    await waitFor(() => expect(useData.getState().settings.onboarded).toBe(true));
    expect((await repos.accounts.getAll())[0]).toMatchObject({ initialBalance: 150000 });
    expect(await screen.findByRole('heading', { name: 'Категории' })).toBeInTheDocument();
  });

  it('«Пропустить» сразу ведёт к созданию счёта', async () => {
    await setupTestRepos();
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Пропустить' }));
    expect(screen.getByRole('heading', { name: 'Первый счёт' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Пропустить' })).not.toBeInTheDocument();
  });
});

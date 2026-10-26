import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../app/App';
import { seedBasic, setupTestRepos } from '../../tests/helpers';
import { hashPin, isValidPin, newSalt, verifyPin } from './pin';

describe('PIN-код', () => {
  it('хэширует с солью и проверяет', async () => {
    const salt = newSalt();
    const hash = await hashPin('1234', salt);
    expect(hash).not.toContain('1234');
    expect(await verifyPin('1234', salt, hash)).toBe(true);
    expect(await verifyPin('4321', salt, hash)).toBe(false);
    expect(await hashPin('1234', newSalt())).not.toBe(hash);
  });

  it('длина от 4 до 6 цифр', () => {
    expect(isValidPin('123')).toBe(false);
    expect(isValidPin('1234')).toBe(true);
    expect(isValidPin('123456')).toBe(true);
    expect(isValidPin('12a4')).toBe(false);
  });

  it('блокирует приложение при запуске', async () => {
    const { repos } = await setupTestRepos();
    await seedBasic(repos);
    const salt = newSalt();
    await repos.settings.update({ pinSalt: salt, pinHash: await hashPin('2580', salt) });
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Введите PIN-код' })).toBeInTheDocument();
    for (const d of ['1', '1', '1', '1']) await user.click(screen.getByRole('button', { name: d }));
    await user.click(screen.getByRole('button', { name: 'Войти' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Неверный PIN-код');

    for (const d of ['2', '5', '8', '0']) await user.click(screen.getByRole('button', { name: d }));
    await user.click(screen.getByRole('button', { name: 'Войти' }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Операции' })).toBeInTheDocument(),
    );
  });
});

describe('настройки', () => {
  afterEach(() => {
    window.location.hash = '';
    document.documentElement.classList.remove('dark');
  });

  it('переключает тёмную тему и первый день недели', async () => {
    const { repos } = await setupTestRepos();
    await seedBasic(repos);
    window.location.hash = '#/settings';
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('radio', { name: 'Тёмная' }));
    await waitFor(() => expect(document.documentElement).toHaveClass('dark'));
    await user.click(screen.getByRole('radio', { name: 'Воскресенье' }));
    await waitFor(async () => expect((await repos.settings.get()).weekStartsOn).toBe(0));
    expect((await repos.settings.get()).theme).toBe('dark');
  });

  it('сброс данных только после ввода подтверждения', async () => {
    const { repos } = await setupTestRepos();
    await seedBasic(repos);
    window.location.hash = '#/settings';
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: /Сбросить все данные/ }));
    const confirm = screen.getByRole('button', { name: 'Удалить всё' });
    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText('Подтверждение'), 'удалить');
    await user.click(confirm);
    await waitFor(async () => expect(await repos.accounts.getAll()).toHaveLength(0));
    expect(await screen.findByRole('heading', { name: 'Первый счёт' })).toBeInTheDocument();
  });
});

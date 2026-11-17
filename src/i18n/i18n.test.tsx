import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach } from 'vitest';
import { App } from '../app/App';
import { defaultCategories } from '../db/seed';
import { dayHeading, periodFor, periodLabel, formatDate } from '../domain/dates';
import { formatMinor, formatMoney, parseMinor } from '../domain/money';
import { useData } from '../stores/dataStore';
import { seedBasic, setupTestRepos } from '../../tests/helpers';
import { en } from './en';
import { ru } from './ru';
import { getLang, resolveLanguage, setLanguage, systemLanguage, translate } from './index';

function mockNavigator(languages: string[]) {
  Object.defineProperty(navigator, 'language', { value: languages[0], configurable: true });
  Object.defineProperty(navigator, 'languages', { value: languages, configurable: true });
}

afterEach(() => mockNavigator(['ru-RU', 'ru']));

describe('словари', () => {
  it('содержат одинаковые ключи', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ru).sort());
  });

  it('параметры в переводах совпадают', () => {
    const params = (v: unknown) =>
      [...new Set(JSON.stringify(v).match(/\{\w+\}/g) ?? [])].sort().join(',');
    for (const key of Object.keys(ru) as (keyof typeof ru)[]) {
      expect(params(en[key]), key).toBe(params(ru[key]));
    }
  });

  it('подставляет параметры и формы множественного числа', () => {
    expect(translate('ru', 'pin.entered', { count: 1 })).toBe('Введена 1 цифра');
    expect(translate('ru', 'pin.entered', { count: 3 })).toBe('Введено 3 цифры');
    expect(translate('ru', 'pin.entered', { count: 5 })).toBe('Введено 5 цифр');
    expect(translate('en', 'pin.entered', { count: 1 })).toBe('1 digit entered');
    expect(translate('en', 'pin.entered', { count: 4 })).toBe('4 digits entered');
    expect(translate('en', 'recurrence.every.week', { count: 2 })).toBe('Every 2 weeks');
  });
});

describe('выбор языка', () => {
  it('system: русский, если система на русском, иначе английский', () => {
    mockNavigator(['ru-RU']);
    expect(systemLanguage()).toBe('ru');
    mockNavigator(['ru']);
    expect(resolveLanguage('system')).toBe('ru');
    mockNavigator(['en-US', 'ru']);
    expect(systemLanguage()).toBe('en');
    mockNavigator(['de-DE']);
    expect(resolveLanguage('system')).toBe('en');
    expect(resolveLanguage(undefined)).toBe('en');
  });

  it('явный выбор важнее языка системы', () => {
    mockNavigator(['ru-RU']);
    expect(resolveLanguage('en')).toBe('en');
    mockNavigator(['en-US']);
    expect(resolveLanguage('ru')).toBe('ru');
  });

  it('обновляет lang у документа', () => {
    setLanguage('en');
    expect(document.documentElement.lang).toBe('en');
    setLanguage('ru');
    expect(document.documentElement.lang).toBe('ru');
  });
});

describe('форматирование на английском', () => {
  it('деньги и числа', () => {
    setLanguage('en');
    expect(formatMinor(123456789, 2)).toBe('1,234,567.89');
    expect(formatMoney(123456, 'KGS')).toBe('1,234.56\u00a0KGS');
    expect(formatMoney(-500, 'USD')).toBe('−$5');
    expect(formatMoney(1000, 'USD', { sign: true })).toBe('+$10');
    // Ввод по-прежнему принимает и точку, и запятую.
    expect(parseMinor('1,234.56')).toBe(123456);
    expect(parseMinor('76,75')).toBe(7675);
    setLanguage('ru');
    expect(formatMoney(123456, 'KGS')).toBe('1\u00a0234,56\u00a0сом');
  });

  it('даты и периоды', () => {
    setLanguage('en');
    const opts = { timeZone: 'Asia/Bishkek', weekStartsOn: 1 as const };
    const at = Date.parse('2026-10-27T08:00:00Z');
    expect(periodLabel(periodFor('month', at, opts), opts.timeZone)).toBe('October 2026');
    expect(periodLabel(periodFor('day', at, opts), opts.timeZone)).toBe('October 27, 2026');
    expect(dayHeading('2026-10-27', at, opts.timeZone)).toBe('Today');
    expect(dayHeading('2026-10-26', at, opts.timeZone)).toBe('Yesterday');
    expect(dayHeading('2026-10-20', at, opts.timeZone)).toBe('Tuesday, October 20');
    expect(formatDate(at, opts.timeZone, 'time')).toBe('2:00 PM');
    setLanguage('ru');
    expect(periodLabel(periodFor('month', at, opts), opts.timeZone)).toBe('октябрь 2026');
  });

  it('стандартные категории создаются на выбранном языке', () => {
    const names = (lang: 'en' | 'ru') =>
      defaultCategories(0, lang)
        .filter((c) => !c.parentId)
        .map((c) => c.name);
    expect(names('en')).toContain('Groceries');
    expect(names('ru')).toContain('Продукты');
    const enSubs = defaultCategories(0, 'en').filter((c) => c.parentId);
    expect(enSubs.map((c) => c.name)).toContain('Supermarket');
  });
});

describe('настройка языка', () => {
  afterEach(() => {
    window.location.hash = '';
  });

  it('переключение в настройках сразу меняет интерфейс и сохраняется', async () => {
    const { repos } = await setupTestRepos();
    await seedBasic(repos);
    window.location.hash = '#/settings';
    const user = userEvent.setup();
    render(<App />);

    const select = await screen.findByLabelText('Язык');
    expect(screen.getByRole('heading', { name: 'Настройки' })).toBeInTheDocument();
    await user.selectOptions(select, 'en');

    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByLabelText('Language')).toHaveValue('en');
    expect(getLang()).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect((await repos.settings.get()).language).toBe('en');

    await user.selectOptions(screen.getByLabelText('Language'), 'system');
    await waitFor(() => expect(getLang()).toBe('ru'));
    expect(await screen.findByRole('heading', { name: 'Настройки' })).toBeInTheDocument();
  });

  it('при первом запуске язык выбирается до создания счёта', async () => {
    await setupTestRepos();
    const user = userEvent.setup();
    render(<App />);
    await user.selectOptions(await screen.findByLabelText('Язык'), 'en');
    await waitFor(() => expect(getLang()).toBe('en'));
    expect(screen.getByLabelText('Language')).toHaveValue('en');
    await user.click(screen.getByRole('button', { name: 'Начать' }));
    await waitFor(() => expect(useData.getState().settings.onboarded).toBe(true));
    const names = useData.getState().categories.map((c) => c.name);
    expect(names).toContain('Groceries');
    expect(names).not.toContain('Продукты');
  });
});

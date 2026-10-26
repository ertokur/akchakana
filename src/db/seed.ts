import type { Account, AccountKind, Category, CategoryKind, CurrencyCode } from '../domain/types';
import { newId } from '../domain/ids';

/** Палитра для счетов и категорий (подобрана под контраст белого текста на заливке). */
export const PALETTE = [
  '#0f766e',
  '#047857',
  '#4d7c0f',
  '#a16207',
  '#c2410c',
  '#b91c1c',
  '#be185d',
  '#a21caf',
  '#7e22ce',
  '#4338ca',
  '#1d4ed8',
  '#0369a1',
  '#475569',
  '#57534e',
];

type SeedCategory = [name: string, icon: string, color: string];

const EXPENSE: SeedCategory[] = [
  ['Продукты', 'cart', '#047857'],
  ['Кафе и рестораны', 'utensils', '#c2410c'],
  ['Транспорт', 'bus', '#1d4ed8'],
  ['Авто', 'car', '#475569'],
  ['Жильё и ЖКХ', 'home', '#a16207'],
  ['Связь и интернет', 'wifi', '#0369a1'],
  ['Здоровье', 'heart-pulse', '#b91c1c'],
  ['Одежда', 'shirt', '#be185d'],
  ['Развлечения', 'gamepad', '#7e22ce'],
  ['Подарки', 'gift', '#a21caf'],
  ['Образование', 'graduation', '#4338ca'],
  ['Дети', 'baby', '#0f766e'],
  ['Путешествия', 'plane', '#0369a1'],
  ['Подписки', 'repeat', '#4d7c0f'],
  ['Прочее', 'dots', '#57534e'],
];

const INCOME: SeedCategory[] = [
  ['Зарплата', 'briefcase', '#047857'],
  ['Подработка', 'laptop', '#0f766e'],
  ['Подарки', 'gift', '#a21caf'],
  ['Проценты', 'percent', '#1d4ed8'],
  ['Возвраты', 'undo', '#a16207'],
  ['Прочее', 'dots', '#57534e'],
];

export function defaultCategories(now = Date.now()): Category[] {
  const make =
    (kind: CategoryKind) =>
    ([name, icon, color]: SeedCategory, order: number) => ({
      id: newId(),
      name,
      kind,
      icon,
      color,
      archived: false,
      order,
      createdAt: now,
      updatedAt: now,
    });
  return [...EXPENSE.map(make('expense')), ...INCOME.map(make('income'))];
}

export const ACCOUNT_KIND_LABELS: Record<AccountKind, string> = {
  cash: 'Наличные',
  card: 'Карта',
  savings: 'Накопления',
  credit: 'Кредитная карта',
};

export const ACCOUNT_KIND_ICONS: Record<AccountKind, string> = {
  cash: 'banknote',
  card: 'credit-card',
  savings: 'piggy-bank',
  credit: 'landmark',
};

export function makeAccount(
  partial: Partial<Account> & { name: string; currency: CurrencyCode },
  now = Date.now(),
): Account {
  const kind = partial.kind ?? 'cash';
  return {
    id: newId(),
    kind,
    initialBalance: 0,
    color: PALETTE[0],
    icon: ACCOUNT_KIND_ICONS[kind],
    archived: false,
    order: 0,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

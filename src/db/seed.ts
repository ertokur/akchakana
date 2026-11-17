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

// Небольшой стартовый набор: 8 категорий расходов как раз помещаются вокруг круга.
const EXPENSE: SeedCategory[] = [
  ['Продукты', 'cart', '#047857'],
  ['Кафе и рестораны', 'utensils', '#c2410c'],
  ['Транспорт', 'bus', '#1d4ed8'],
  ['Жильё и ЖКХ', 'home', '#a16207'],
  ['Здоровье', 'heart-pulse', '#b91c1c'],
  ['Развлечения', 'gamepad', '#7e22ce'],
  ['Одежда', 'shirt', '#be185d'],
  ['Прочее', 'dots', '#57534e'],
];

const INCOME: SeedCategory[] = [
  ['Зарплата', 'briefcase', '#047857'],
  ['Подарки', 'gift', '#a21caf'],
  ['Прочее', 'dots', '#57534e'],
];

/** Стандартные подкатегории расходов: название родителя → [название, иконка]. */
export const DEFAULT_SUBCATEGORIES: Record<string, [name: string, icon: string][]> = {
  Продукты: [
    ['Супермаркет', 'cart'],
    ['Рынок', 'cart'],
    ['Хлеб и выпечка', 'cart'],
  ],
  'Кафе и рестораны': [
    ['Ресторан', 'utensils'],
    ['Кофе', 'coffee'],
    ['Доставка еды', 'utensils'],
    ['Фастфуд', 'utensils'],
  ],
  Транспорт: [
    ['Общественный транспорт', 'bus'],
    ['Такси', 'taxi'],
    ['Поезд и межгород', 'train'],
  ],
  Авто: [
    ['Топливо', 'fuel'],
    ['Обслуживание и ремонт', 'hammer'],
    ['Парковка', 'car'],
    ['Страховка', 'car'],
  ],
  'Жильё и ЖКХ': [
    ['Аренда', 'home'],
    ['Электричество', 'zap'],
    ['Вода', 'droplet'],
    ['Газ и отопление', 'flame'],
    ['Ремонт и мебель', 'hammer'],
  ],
  'Связь и интернет': [
    ['Мобильная связь', 'smartphone'],
    ['Домашний интернет', 'wifi'],
    ['ТВ', 'tv'],
  ],
  Здоровье: [
    ['Аптека', 'pill'],
    ['Врачи и анализы', 'heart-pulse'],
    ['Спорт', 'dumbbell'],
  ],
  Одежда: [
    ['Одежда', 'shirt'],
    ['Обувь', 'shirt'],
    ['Аксессуары', 'tag'],
  ],
  Развлечения: [
    ['Кино и концерты', 'film'],
    ['Игры', 'gamepad'],
    ['Хобби', 'sparkles'],
  ],
  Образование: [
    ['Курсы', 'graduation'],
    ['Книги', 'book'],
  ],
  Дети: [
    ['Игрушки', 'baby'],
    ['Кружки и школа', 'graduation'],
  ],
  Путешествия: [
    ['Билеты', 'plane'],
    ['Жильё в поездке', 'home'],
  ],
  Подписки: [
    ['Музыка и видео', 'music'],
    ['Приложения', 'smartphone'],
  ],
};

export function defaultCategories(now = Date.now()): Category[] {
  const make =
    (kind: CategoryKind) =>
    ([name, icon, color]: SeedCategory, order: number): Category => ({
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
  const parents = [...EXPENSE.map(make('expense')), ...INCOME.map(make('income'))];
  return [...parents, ...missingDefaultSubcategories(parents, now)];
}

/**
 * Стандартные подкатегории для родителей с известными названиями, у которых подкатегорий ещё нет.
 * Используется при первом запуске и кнопкой «Добавить стандартные подкатегории».
 */
export function missingDefaultSubcategories(categories: Category[], now = Date.now()): Category[] {
  const norm = (s: string) => s.trim().toLowerCase().replace(/ё/g, 'е');
  const defaults = new Map(Object.entries(DEFAULT_SUBCATEGORIES).map(([k, v]) => [norm(k), v]));
  const withChildren = new Set(categories.filter((c) => c.parentId).map((c) => c.parentId));
  return categories
    .filter((c) => c.kind === 'expense' && !c.parentId && !c.archived && !withChildren.has(c.id))
    .flatMap((parent) =>
      (defaults.get(norm(parent.name)) ?? []).map(([name, icon], order) => ({
        id: newId(),
        name,
        kind: parent.kind,
        parentId: parent.id,
        icon,
        color: parent.color,
        archived: false,
        order,
        createdAt: now,
        updatedAt: now,
      })),
    );
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

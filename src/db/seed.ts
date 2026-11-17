import type { Account, AccountKind, Category, CategoryKind, CurrencyCode } from '../domain/types';
import { newId } from '../domain/ids';
import { getLang, LANGUAGES, type Lang } from '../i18n';

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

/** Названия стандартных категорий на каждом языке (иконки и цвета общие). */
const NAMES: Record<Lang, { expense: string[]; income: string[] }> = {
  ru: {
    expense: [
      'Продукты',
      'Кафе и рестораны',
      'Транспорт',
      'Жильё и ЖКХ',
      'Здоровье',
      'Развлечения',
      'Одежда',
      'Прочее',
    ],
    income: ['Зарплата', 'Подарки', 'Прочее'],
  },
  en: {
    expense: [
      'Groceries',
      'Cafes & restaurants',
      'Transport',
      'Housing & utilities',
      'Health',
      'Entertainment',
      'Clothing',
      'Other',
    ],
    income: ['Salary', 'Gifts', 'Other'],
  },
};

// Небольшой стартовый набор: 8 категорий расходов как раз помещаются вокруг круга.
const EXPENSE_STYLE: [icon: string, color: string][] = [
  ['cart', '#047857'],
  ['utensils', '#c2410c'],
  ['bus', '#1d4ed8'],
  ['home', '#a16207'],
  ['heart-pulse', '#b91c1c'],
  ['gamepad', '#7e22ce'],
  ['shirt', '#be185d'],
  ['dots', '#57534e'],
];

const INCOME_STYLE: [icon: string, color: string][] = [
  ['briefcase', '#047857'],
  ['gift', '#a21caf'],
  ['dots', '#57534e'],
];

const seedList = (names: string[], styles: [string, string][]): SeedCategory[] =>
  styles.map(([icon, color], i) => [names[i], icon, color]);

type SubcategorySeed = [name: string, icon: string][];

/** Стандартные подкатегории расходов по языкам: название родителя → [название, иконка]. */
export const DEFAULT_SUBCATEGORIES_BY_LANG: Record<Lang, Record<string, SubcategorySeed>> = {
  ru: {
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
  },
  en: {
    Groceries: [
      ['Supermarket', 'cart'],
      ['Market', 'cart'],
      ['Bakery', 'cart'],
    ],
    'Cafes & restaurants': [
      ['Restaurant', 'utensils'],
      ['Coffee', 'coffee'],
      ['Food delivery', 'utensils'],
      ['Fast food', 'utensils'],
    ],
    Transport: [
      ['Public transport', 'bus'],
      ['Taxi', 'taxi'],
      ['Trains & intercity', 'train'],
    ],
    Car: [
      ['Fuel', 'fuel'],
      ['Service & repairs', 'hammer'],
      ['Parking', 'car'],
      ['Insurance', 'car'],
    ],
    'Housing & utilities': [
      ['Rent', 'home'],
      ['Electricity', 'zap'],
      ['Water', 'droplet'],
      ['Gas & heating', 'flame'],
      ['Repairs & furniture', 'hammer'],
    ],
    'Phone & internet': [
      ['Mobile', 'smartphone'],
      ['Home internet', 'wifi'],
      ['TV', 'tv'],
    ],
    Health: [
      ['Pharmacy', 'pill'],
      ['Doctors & tests', 'heart-pulse'],
      ['Sports', 'dumbbell'],
    ],
    Clothing: [
      ['Clothes', 'shirt'],
      ['Shoes', 'shirt'],
      ['Accessories', 'tag'],
    ],
    Entertainment: [
      ['Movies & concerts', 'film'],
      ['Games', 'gamepad'],
      ['Hobbies', 'sparkles'],
    ],
    Education: [
      ['Courses', 'graduation'],
      ['Books', 'book'],
    ],
    Kids: [
      ['Toys', 'baby'],
      ['Activities & school', 'graduation'],
    ],
    Travel: [
      ['Tickets', 'plane'],
      ['Accommodation', 'home'],
    ],
    Subscriptions: [
      ['Music & video', 'music'],
      ['Apps', 'smartphone'],
    ],
  },
};

/** Русские стандартные подкатегории (для обратной совместимости). */
export const DEFAULT_SUBCATEGORIES = DEFAULT_SUBCATEGORIES_BY_LANG.ru;

/** Стандартные категории нового приложения на языке `lang` (по умолчанию — текущий язык). */
export function defaultCategories(now = Date.now(), lang: Lang = getLang()): Category[] {
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
  const names = NAMES[lang];
  const parents = [
    ...seedList(names.expense, EXPENSE_STYLE).map(make('expense')),
    ...seedList(names.income, INCOME_STYLE).map(make('income')),
  ];
  return [...parents, ...missingDefaultSubcategories(parents, now)];
}

/**
 * Стандартные подкатегории для родителей с известными названиями (на любом из языков),
 * у которых подкатегорий ещё нет. Подкатегории создаются на языке названия родителя.
 * Используется при первом запуске и кнопкой «Добавить стандартные подкатегории».
 */
export function missingDefaultSubcategories(categories: Category[], now = Date.now()): Category[] {
  const norm = (s: string) => s.trim().toLowerCase().replace(/ё/g, 'е');
  const defaults = new Map(
    LANGUAGES.flatMap((lang) =>
      Object.entries(DEFAULT_SUBCATEGORIES_BY_LANG[lang]).map(([k, v]) => [norm(k), v] as const),
    ),
  );
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

export const ACCOUNT_KINDS: AccountKind[] = ['cash', 'card', 'savings', 'credit'];

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

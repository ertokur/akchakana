/** Все суммы — целые числа в минимальных единицах валюты (тыйын, копейки, центы). */
export type Minor = number;
/** Момент времени в миллисекундах Unix (UTC). */
export type Timestamp = number;
export type CurrencyCode = string;
export type Id = string;

export interface SourceRef {
  kind: 'onemoney' | 'csv';
  externalId: string;
}

interface Entity {
  id: Id;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  source?: SourceRef;
}

export type AccountKind = 'cash' | 'card' | 'savings' | 'credit';

export interface Account extends Entity {
  name: string;
  kind: AccountKind;
  currency: CurrencyCode;
  initialBalance: Minor;
  color: string;
  icon: string;
  archived: boolean;
  order: number;
  creditLimit?: Minor;
}

export type CategoryKind = 'expense' | 'income';

export interface Category extends Entity {
  name: string;
  kind: CategoryKind;
  parentId?: Id;
  color: string;
  icon: string;
  archived: boolean;
  order: number;
}

export type TransactionType = 'expense' | 'income' | 'transfer';

export interface Transaction extends Entity {
  type: TransactionType;
  /** Счёт операции; для перевода — счёт-источник. */
  accountId: Id;
  /** Счёт-получатель перевода. */
  toAccountId?: Id;
  categoryId?: Id;
  /** Обычно положительная. Отрицательная сумма — возврат (isRefund). */
  amount: Minor;
  isRefund: boolean;
  /** Сумма зачисления для перевода между счетами с разной валютой. */
  toAmount?: Minor;
  currency: CurrencyCode;
  date: Timestamp;
  note: string;
  tags: string[];
}

export interface Budget extends Entity {
  /** null — общий бюджет на все расходы. */
  categoryId: Id | null;
  period: 'month';
  limit: Minor;
  currency: CurrencyCode;
  /** Месяц начала действия, `yyyy-MM`. */
  startMonth: string;
}

export type RecurrenceFreq = 'day' | 'week' | 'month' | 'year';

export type TransactionTemplate = Pick<
  Transaction,
  | 'type'
  | 'accountId'
  | 'toAccountId'
  | 'categoryId'
  | 'amount'
  | 'toAmount'
  | 'currency'
  | 'note'
  | 'tags'
>;

export interface RecurringRule extends Entity {
  name: string;
  template: TransactionTemplate;
  freq: RecurrenceFreq;
  interval: number;
  startDate: Timestamp;
  nextDate: Timestamp;
  endDate?: Timestamp;
  /** auto — операция создаётся сама, remind — только напоминание с подтверждением. */
  mode: 'auto' | 'remind';
  active: boolean;
  lastNotifiedAt?: Timestamp;
}

export type DebtDirection = 'owedToMe' | 'iOwe';

export interface Debt extends Entity {
  direction: DebtDirection;
  person: string;
  amount: Minor;
  currency: CurrencyCode;
  accountId?: Id;
  dueDate?: Timestamp;
  note: string;
  settled: boolean;
  /** Погашения: суммы и даты. */
  payments: { date: Timestamp; amount: Minor }[];
}

export type ThemeSetting = 'light' | 'dark' | 'system';

export interface Settings {
  id: 'settings';
  defaultCurrency: CurrencyCode;
  timeZone: string;
  /** 0 — воскресенье, 1 — понедельник. */
  weekStartsOn: 0 | 1;
  theme: ThemeSetting;
  pinHash?: string;
  pinSalt?: string;
  lastExportAt?: Timestamp;
  onboarded: boolean;
  notificationsEnabled: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  defaultCurrency: 'KGS',
  timeZone: 'Asia/Bishkek',
  weekStartsOn: 1,
  theme: 'system',
  onboarded: false,
  notificationsEnabled: false,
};

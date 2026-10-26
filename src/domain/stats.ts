import { daysOfPeriod, dayKey, monthKey, monthsOfPeriod, type Period } from './dates';
import type { Category, CategoryKind, CurrencyCode, Id, Minor, Transaction } from './types';

export interface CategorySlice {
  categoryId: Id | null;
  name: string;
  color: string;
  icon: string;
  amount: Minor;
}

/**
 * Суммы по категориям за набор операций одной валюты.
 * Подкатегории сворачиваются в родителя (rollUp) или показываются отдельно внутри родителя (parentId).
 * Возвраты (отрицательные суммы) уменьшают сумму категории; неположительные итоги отбрасываются.
 */
export function totalsByCategory(
  transactions: Transaction[],
  categories: Category[],
  kind: CategoryKind,
  currency: CurrencyCode,
  opts: { parentId?: Id } = {},
): CategorySlice[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const sums = new Map<Id | null, Minor>();
  for (const t of transactions) {
    if (t.type !== kind || t.currency !== currency) continue;
    const cat = t.categoryId ? byId.get(t.categoryId) : undefined;
    let key: Id | null;
    if (opts.parentId) {
      if (!cat || (cat.id !== opts.parentId && cat.parentId !== opts.parentId)) continue;
      key = cat.id;
    } else {
      key = cat ? (cat.parentId && byId.has(cat.parentId) ? cat.parentId : cat.id) : null;
    }
    sums.set(key, (sums.get(key) ?? 0) + t.amount);
  }
  return [...sums]
    .filter(([, amount]) => amount > 0)
    .map(([id, amount]) => {
      const c = id ? byId.get(id) : undefined;
      const isParentItself = opts.parentId && id === opts.parentId;
      return {
        categoryId: id,
        name: c ? (isParentItself ? `${c.name} (без подкатегории)` : c.name) : 'Без категории',
        color: c?.color ?? '#57534e',
        icon: c?.icon ?? 'tag',
        amount,
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

/** Сворачивает хвост в «Прочее», чтобы на диаграмме было не больше maxSlices секторов. */
export function foldSmallSlices(slices: CategorySlice[], maxSlices = 8): CategorySlice[] {
  if (slices.length <= maxSlices) return slices;
  const head = slices.slice(0, maxSlices - 1);
  const rest = slices.slice(maxSlices - 1).reduce((s, x) => s + x.amount, 0);
  return [
    ...head,
    { categoryId: '__other', name: 'Остальное', color: '#78716c', icon: 'dots', amount: rest },
  ];
}

export type Bucket = 'day' | 'month';

export interface BucketPoint {
  key: string;
  income: Minor;
  expense: Minor;
}

/** Длинные периоды показываем по месяцам, короткие — по дням. */
export function bucketFor(period: Period, timeZone: string): Bucket {
  return daysOfPeriod(period, timeZone).length > 62 ? 'month' : 'day';
}

/** Доходы и расходы по дням или месяцам периода (пустые интервалы тоже присутствуют). */
export function seriesByBucket(
  transactions: Transaction[],
  period: Period,
  timeZone: string,
  currency: CurrencyCode,
  bucket: Bucket = bucketFor(period, timeZone),
): BucketPoint[] {
  const keys = bucket === 'day' ? daysOfPeriod(period, timeZone) : monthsOfPeriod(period, timeZone);
  const points = new Map(keys.map((key) => [key, { key, income: 0, expense: 0 }]));
  for (const t of transactions) {
    if (t.currency !== currency || t.type === 'transfer') continue;
    if (t.date < period.start || t.date >= period.end) continue;
    const key = bucket === 'day' ? dayKey(t.date, timeZone) : monthKey(t.date, timeZone);
    const p = points.get(key);
    if (!p) continue;
    if (t.type === 'income') p.income += t.amount;
    else p.expense += t.amount;
  }
  return [...points.values()];
}

/** Изменение в процентах к прошлому периоду; null, если сравнивать не с чем. */
export function changePercent(current: Minor, previous: Minor): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

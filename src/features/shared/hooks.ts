import { useEffect, useMemo, useState } from 'react';
import { computeBalances } from '../../domain/balances';
import {
  allTimePeriod,
  customPeriod,
  periodFor,
  type Period,
  type PeriodOptions,
} from '../../domain/dates';
import type { Account, Category, Id, Transaction } from '../../domain/types';
import { useData } from '../../stores/dataStore';
import { t } from '../../i18n';
import { useUi, type PeriodSelection } from '../../stores/uiStore';

export function usePeriodOptions(): PeriodOptions {
  const timeZone = useData((s) => s.settings.timeZone);
  const weekStartsOn = useData((s) => s.settings.weekStartsOn);
  return useMemo(() => ({ timeZone, weekStartsOn }), [timeZone, weekStartsOn]);
}

/**
 * Выбранный период. Для «всего времени» нужны даты операций: период тянется
 * от месяца первой до месяца последней операции.
 */
export function resolvePeriod(
  sel: PeriodSelection,
  opts: PeriodOptions,
  transactions: readonly Transaction[] = [],
  now: number = Date.now(),
): Period {
  if (sel.kind === 'all')
    return allTimePeriod(
      transactions.map((t) => t.date),
      now,
      opts,
    );
  if (sel.kind === 'custom' && sel.from && sel.to) return customPeriod(sel.from, sel.to, opts);
  return periodFor(sel.kind === 'custom' ? 'month' : sel.kind, sel.anchor, opts);
}

export function usePeriod(): Period {
  const sel = useUi((s) => s.period);
  const opts = usePeriodOptions();
  const transactions = useData((s) => s.transactions);
  const all = sel.kind === 'all';
  return useMemo(
    () => resolvePeriod(sel, opts, all ? transactions : [], sel.anchor),
    // Операции нужны только для «всего времени», иначе период не пересчитывается при каждой записи.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sel, opts, all ? transactions : null],
  );
}

export function useLookups(): {
  accountsById: Map<Id, Account>;
  categoriesById: Map<Id, Category>;
} {
  const accounts = useData((s) => s.accounts);
  const categories = useData((s) => s.categories);
  return useMemo(
    () => ({
      accountsById: new Map(accounts.map((a) => [a.id, a])),
      categoriesById: new Map(categories.map((c) => [c.id, c])),
    }),
    [accounts, categories],
  );
}

export function useBalances(): Map<Id, number> {
  const accounts = useData((s) => s.accounts);
  const transactions = useData((s) => s.transactions);
  return useMemo(() => computeBalances(accounts, transactions), [accounts, transactions]);
}

/** Полное имя категории: «Транспорт / Такси» для подкатегории. */
export function categoryTitle(c: Category | undefined, byId: Map<Id, Category>): string {
  if (!c) return t('common.noCategory');
  const parent = c.parentId ? byId.get(c.parentId) : undefined;
  return parent ? `${parent.name} / ${c.name}` : c.name;
}

/** Текущее время, обновляется раз в минуту (для «Сегодня»/«Вчера» и напоминаний). */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

import { useEffect, useMemo, useState } from 'react';
import { computeBalances } from '../../domain/balances';
import { customPeriod, periodFor, type Period, type PeriodOptions } from '../../domain/dates';
import type { Account, Category, Id } from '../../domain/types';
import { useData } from '../../stores/dataStore';
import { useUi, type PeriodSelection } from '../../stores/uiStore';

export function usePeriodOptions(): PeriodOptions {
  const timeZone = useData((s) => s.settings.timeZone);
  const weekStartsOn = useData((s) => s.settings.weekStartsOn);
  return useMemo(() => ({ timeZone, weekStartsOn }), [timeZone, weekStartsOn]);
}

export function resolvePeriod(sel: PeriodSelection, opts: PeriodOptions): Period {
  if (sel.kind === 'custom' && sel.from && sel.to) return customPeriod(sel.from, sel.to, opts);
  return periodFor(sel.kind === 'custom' ? 'month' : sel.kind, sel.anchor, opts);
}

export function usePeriod(): Period {
  const sel = useUi((s) => s.period);
  const opts = usePeriodOptions();
  return useMemo(() => resolvePeriod(sel, opts), [sel, opts]);
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
  if (!c) return 'Без категории';
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

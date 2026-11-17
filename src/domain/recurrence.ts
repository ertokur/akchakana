import { addDays, addMonths, addWeeks, addYears } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import type { RecurrenceFreq, RecurringRule, Timestamp } from './types';
import { t } from '../i18n';

const ADDERS: Record<RecurrenceFreq, (d: Date, n: number) => Date> = {
  day: addDays,
  week: addWeeks,
  month: addMonths,
  year: addYears,
};

/**
 * N-е повторение правила (0 — дата начала). Считается от даты начала, а не от предыдущего
 * повторения, поэтому платёж 31-го числа не «съезжает»: 31 янв → 28/29 фев → 31 мар.
 * Время суток сохраняется в часовом поясе пользователя.
 */
export function occurrenceAt(
  rule: Pick<RecurringRule, 'startDate' | 'freq' | 'interval'>,
  n: number,
  timeZone: string,
): Timestamp {
  const wall = toZonedTime(rule.startDate, timeZone);
  const moved = ADDERS[rule.freq](wall, n * Math.max(1, rule.interval));
  return fromZonedTime(moved, timeZone).getTime();
}

/** Первое повторение строго позже `after` (или null, если правило уже закончилось). */
export function nextOccurrenceAfter(
  rule: Pick<RecurringRule, 'startDate' | 'freq' | 'interval' | 'endDate'>,
  after: Timestamp,
  timeZone: string,
): Timestamp | null {
  for (let n = 0; n < 100_000; n++) {
    const ts = occurrenceAt(rule, n, timeZone);
    if (rule.endDate !== undefined && ts > rule.endDate) return null;
    if (ts > after) return ts;
  }
  return null;
}

/** Все наступившие повторения начиная с rule.nextDate и не позже now (не более limit). */
export function dueOccurrences(
  rule: RecurringRule,
  now: Timestamp,
  timeZone: string,
  limit = 366,
): Timestamp[] {
  const result: Timestamp[] = [];
  if (!rule.active) return result;
  let next: Timestamp | null = rule.nextDate;
  while (next !== null && next <= now && result.length < limit) {
    if (rule.endDate !== undefined && next > rule.endDate) break;
    result.push(next);
    next = nextOccurrenceAfter(rule, next, timeZone);
  }
  return result;
}

export const FREQS: RecurrenceFreq[] = ['day', 'week', 'month', 'year'];

/** «Каждый день», «Каждую неделю»… на текущем языке. */
export function freqLabel(freq: RecurrenceFreq): string {
  return t(`recurrence.freq.${freq}`);
}

export function describeRule(rule: Pick<RecurringRule, 'freq' | 'interval'>): string {
  if (rule.interval <= 1) return freqLabel(rule.freq);
  return t(`recurrence.every.${rule.freq}`, { count: rule.interval });
}

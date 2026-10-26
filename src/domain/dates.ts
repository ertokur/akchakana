import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from 'date-fns';
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';
import { ru } from 'date-fns/locale';
import type { Timestamp } from './types';

export type PeriodKind = 'day' | 'week' | 'month' | 'year' | 'custom';

export interface Period {
  kind: PeriodKind;
  /** Начало периода (включительно), UTC мс. */
  start: Timestamp;
  /** Конец периода (не включительно), UTC мс. */
  end: Timestamp;
}

export interface PeriodOptions {
  timeZone: string;
  weekStartsOn: 0 | 1;
}

const DAY_MS = 86_400_000;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Ключ `yyyy-MM-dd` для «настенной» даты (поля Date без учёта пояса). */
function wallKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function wallDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Полночь дня `key` в поясе timeZone, UTC мс. */
export function startOfDayKey(key: string, timeZone: string): Timestamp {
  return fromZonedTime(`${key}T00:00:00`, timeZone).getTime();
}

/**
 * Периоды считаются в часовом поясе пользователя: момент переводится в «настенную» дату пояса,
 * границы вычисляются по календарю, затем полночь границы переводится обратно в UTC.
 */
export function periodFor(
  kind: Exclude<PeriodKind, 'custom'>,
  at: Timestamp,
  opts: PeriodOptions,
): Period {
  const zoned = toZonedTime(at, opts.timeZone);
  let start: Date;
  let end: Date;
  switch (kind) {
    case 'day':
      start = startOfDay(zoned);
      end = addDays(start, 1);
      break;
    case 'week':
      start = startOfWeek(zoned, { weekStartsOn: opts.weekStartsOn });
      end = addWeeks(start, 1);
      break;
    case 'month':
      start = startOfMonth(zoned);
      end = addMonths(start, 1);
      break;
    case 'year':
      start = startOfYear(zoned);
      end = addYears(start, 1);
      break;
  }
  return {
    kind,
    start: startOfDayKey(wallKey(start), opts.timeZone),
    end: startOfDayKey(wallKey(end), opts.timeZone),
  };
}

/** Произвольный период: с начала дня `from` по конец дня `to` включительно (даты `yyyy-MM-dd`). */
export function customPeriod(from: string, to: string, opts: PeriodOptions): Period {
  const [a, b] = from <= to ? [from, to] : [to, from];
  return {
    kind: 'custom',
    start: startOfDayKey(a, opts.timeZone),
    end: startOfDayKey(wallKey(addDays(wallDate(b), 1)), opts.timeZone),
  };
}

/** Сдвигает период на delta шагов. Произвольный сдвигается на свою длину в днях. */
export function shiftPeriod(period: Period, delta: number, opts: PeriodOptions): Period {
  const startKey = dayKey(period.start, opts.timeZone);
  if (period.kind === 'custom') {
    const lastKey = dayKey(period.end - 1, opts.timeZone);
    const days = differenceInCalendarDays(wallDate(lastKey), wallDate(startKey)) + 1;
    return customPeriod(
      wallKey(addDays(wallDate(startKey), days * delta)),
      wallKey(addDays(wallDate(lastKey), days * delta)),
      opts,
    );
  }
  const shifters = { day: addDays, week: addWeeks, month: addMonths, year: addYears };
  const moved = wallKey(shifters[period.kind](wallDate(startKey), delta));
  // Берём полдень, чтобы не попасть на границу суток.
  return periodFor(period.kind, startOfDayKey(moved, opts.timeZone) + DAY_MS / 2, opts);
}

/** Предыдущий период той же длины (для сравнения в статистике). */
export function previousPeriod(period: Period, opts: PeriodOptions): Period {
  return shiftPeriod(period, -1, opts);
}

/** Ключ дня `yyyy-MM-dd` в часовом поясе пользователя. */
export function dayKey(ts: Timestamp, timeZone: string): string {
  return formatInTimeZone(ts, timeZone, 'yyyy-MM-dd');
}

/** Ключ месяца `yyyy-MM` в часовом поясе пользователя. */
export function monthKey(ts: Timestamp, timeZone: string): string {
  return formatInTimeZone(ts, timeZone, 'yyyy-MM');
}

/** Список ключей дней периода. */
export function daysOfPeriod(period: Period, timeZone: string): string[] {
  const keys: string[] = [];
  const lastKey = dayKey(period.end - 1, timeZone);
  let d = wallDate(dayKey(period.start, timeZone));
  for (let guard = 0; guard < 400; guard++) {
    const key = wallKey(d);
    keys.push(key);
    if (key >= lastKey) break;
    d = addDays(d, 1);
  }
  return keys;
}

/** Список ключей месяцев периода. */
export function monthsOfPeriod(period: Period, timeZone: string): string[] {
  const keys: string[] = [];
  const last = monthKey(period.end - 1, timeZone);
  let d = wallDate(`${monthKey(period.start, timeZone)}-01`);
  for (let guard = 0; guard < 600; guard++) {
    const key = wallKey(d).slice(0, 7);
    keys.push(key);
    if (key >= last) break;
    d = addMonths(d, 1);
  }
  return keys;
}

export function formatInTz(ts: Timestamp, timeZone: string, pattern: string): string {
  return formatInTimeZone(ts, timeZone, pattern, { locale: ru });
}

/** Подпись периода для переключателя: «27 октября 2026», «октябрь 2026», «2026». */
export function periodLabel(period: Period, timeZone: string): string {
  const f = (ts: Timestamp, p: string) => formatInTz(ts, timeZone, p);
  const last = period.end - 1;
  switch (period.kind) {
    case 'day':
      return f(period.start, 'd MMMM yyyy');
    case 'month':
      return f(period.start, 'LLLL yyyy');
    case 'year':
      return f(period.start, 'yyyy');
    default:
      if (f(period.start, 'yyyy') === f(last, 'yyyy')) {
        return `${f(period.start, 'd MMM')} – ${f(last, 'd MMM yyyy')}`;
      }
      return `${f(period.start, 'd MMM yyyy')} – ${f(last, 'd MMM yyyy')}`;
  }
}

/** Подпись дня в списке: «Сегодня», «Вчера» или «понедельник, 26 октября». */
export function dayHeading(key: string, now: Timestamp, timeZone: string): string {
  const today = dayKey(now, timeZone);
  if (key === today) return 'Сегодня';
  if (key === wallKey(addDays(wallDate(today), -1))) return 'Вчера';
  const ts = startOfDayKey(key, timeZone) + DAY_MS / 2;
  const sameYear = key.slice(0, 4) === today.slice(0, 4);
  return formatInTz(ts, timeZone, sameYear ? 'EEEE, d MMMM' : 'EEEE, d MMMM yyyy');
}

/** Значение для `<input type="datetime-local">` в поясе пользователя. */
export function toDateTimeInput(ts: Timestamp, timeZone: string): string {
  return formatInTimeZone(ts, timeZone, "yyyy-MM-dd'T'HH:mm");
}

export function fromDateTimeInput(value: string, timeZone: string): Timestamp {
  return fromZonedTime(value.length === 16 ? `${value}:00` : value, timeZone).getTime();
}

/** ISO 8601 со смещением пояса: `2026-10-27T14:30:00+06:00` (для экспорта). */
export function toIsoWithOffset(ts: Timestamp, timeZone: string): string {
  const ms = ts % 1000 !== 0 ? '.SSS' : '';
  return formatInTimeZone(ts, timeZone, `yyyy-MM-dd'T'HH:mm:ss${ms}XXX`);
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

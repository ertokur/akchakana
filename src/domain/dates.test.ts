import {
  customPeriod,
  dayHeading,
  dayKey,
  daysOfPeriod,
  fromDateTimeInput,
  monthsOfPeriod,
  periodFor,
  periodLabel,
  previousPeriod,
  shiftPeriod,
  toDateTimeInput,
  toIsoWithOffset,
} from './dates';

const opts = { timeZone: 'Asia/Bishkek', weekStartsOn: 1 as const };
const iso = (s: string) => Date.parse(s);

describe('периоды в часовом поясе пользователя', () => {
  it('день: граница суток UTC+6', () => {
    // 2026-10-26 20:00 UTC = 27 октября 02:00 в Бишкеке.
    const p = periodFor('day', iso('2026-10-26T20:00:00Z'), opts);
    expect(p.start).toBe(iso('2026-10-26T18:00:00Z'));
    expect(p.end).toBe(iso('2026-10-27T18:00:00Z'));
    expect(dayKey(iso('2026-10-26T20:00:00Z'), opts.timeZone)).toBe('2026-10-27');
    expect(dayKey(iso('2026-10-26T17:59:59Z'), opts.timeZone)).toBe('2026-10-26');
  });

  it('неделя с понедельника и с воскресенья', () => {
    const at = iso('2026-10-28T06:00:00Z'); // среда
    expect(dayKey(periodFor('week', at, opts).start, opts.timeZone)).toBe('2026-10-26');
    const sunday = periodFor('week', at, { ...opts, weekStartsOn: 0 });
    expect(dayKey(sunday.start, opts.timeZone)).toBe('2026-10-25');
  });

  it('месяц и год', () => {
    const at = iso('2026-02-15T06:00:00Z');
    const m = periodFor('month', at, opts);
    expect(m.start).toBe(iso('2026-01-31T18:00:00Z'));
    expect(m.end).toBe(iso('2026-02-28T18:00:00Z'));
    const y = periodFor('year', at, opts);
    expect(y.start).toBe(iso('2025-12-31T18:00:00Z'));
    expect(periodLabel(m, opts.timeZone)).toBe('февраль 2026');
  });

  it('сдвиг и предыдущий период', () => {
    const m = periodFor('month', iso('2026-03-31T06:00:00Z'), opts);
    const prev = previousPeriod(m, opts);
    expect(dayKey(prev.start, opts.timeZone)).toBe('2026-02-01');
    const next = shiftPeriod(m, 1, opts);
    expect(dayKey(next.start, opts.timeZone)).toBe('2026-04-01');
    const custom = customPeriod('2026-10-01', '2026-10-10', opts);
    const shifted = shiftPeriod(custom, -1, opts);
    expect(dayKey(shifted.start, opts.timeZone)).toBe('2026-09-21');
    expect(dayKey(shifted.end - 1, opts.timeZone)).toBe('2026-09-30');
  });

  it('списки дней и месяцев', () => {
    const w = periodFor('week', iso('2026-10-28T06:00:00Z'), opts);
    expect(daysOfPeriod(w, opts.timeZone)).toHaveLength(7);
    const y = periodFor('year', iso('2026-05-01T06:00:00Z'), opts);
    expect(monthsOfPeriod(y, opts.timeZone)).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
      '2026-11',
      '2026-12',
    ]);
  });

  it('другой часовой пояс', () => {
    const p = periodFor('day', iso('2026-10-26T20:00:00Z'), { ...opts, timeZone: 'Europe/Moscow' });
    expect(p.start).toBe(iso('2026-10-25T21:00:00Z'));
  });
});

describe('форматирование дат', () => {
  it('поле ввода даты и времени туда и обратно', () => {
    const ts = iso('2026-10-27T08:30:00Z');
    expect(toDateTimeInput(ts, opts.timeZone)).toBe('2026-10-27T14:30');
    expect(fromDateTimeInput('2026-10-27T14:30', opts.timeZone)).toBe(ts);
  });

  it('ISO со смещением', () => {
    expect(toIsoWithOffset(iso('2026-10-27T08:30:00Z'), opts.timeZone)).toBe(
      '2026-10-27T14:30:00+06:00',
    );
    expect(toIsoWithOffset(iso('2026-10-27T08:30:00.123Z'), opts.timeZone)).toBe(
      '2026-10-27T14:30:00.123+06:00',
    );
  });

  it('подписи дней', () => {
    const now = iso('2026-10-27T08:00:00Z');
    expect(dayHeading('2026-10-27', now, opts.timeZone)).toBe('Сегодня');
    expect(dayHeading('2026-10-26', now, opts.timeZone)).toBe('Вчера');
    expect(dayHeading('2026-10-20', now, opts.timeZone)).toBe('вторник, 20 октября');
  });
});

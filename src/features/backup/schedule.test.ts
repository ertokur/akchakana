import { DEFAULT_SETTINGS, type Settings } from '../../domain/types';
import {
  backupFileName,
  isBackupDue,
  lastFileBackupAt,
  nextBackupAt,
  shouldOfferBackupFile,
  snapshotsToDelete,
} from './schedule';

const TZ = 'Asia/Bishkek'; // UTC+6
const at = (iso: string) => Date.parse(iso);

describe('расписание резервных копий', () => {
  it('ежедневно: срок — полночь следующего дня в поясе пользователя', () => {
    // 23:30 по Бишкеку 10 марта.
    const last = at('2026-03-10T17:30:00Z');
    expect(nextBackupAt(last, 'daily', TZ)).toBe(at('2026-03-10T18:00:00Z'));
    expect(isBackupDue(last, 'daily', at('2026-03-10T17:59:00Z'), TZ)).toBe(false);
    expect(isBackupDue(last, 'daily', at('2026-03-10T18:00:00Z'), TZ)).toBe(true);
  });

  it('еженедельно и ежемесячно', () => {
    const last = at('2026-01-31T06:00:00Z');
    expect(nextBackupAt(last, 'weekly', TZ)).toBe(at('2026-02-06T18:00:00Z'));
    // 31 января + месяц = 28 февраля.
    expect(nextBackupAt(last, 'monthly', TZ)).toBe(at('2026-02-27T18:00:00Z'));
    expect(isBackupDue(last, 'monthly', at('2026-02-20T06:00:00Z'), TZ)).toBe(false);
    expect(isBackupDue(last, 'monthly', at('2026-02-28T06:00:00Z'), TZ)).toBe(true);
  });

  it('без копий срок уже наступил', () => {
    expect(isBackupDue(undefined, 'weekly', Date.now(), TZ)).toBe(true);
  });

  it('срок файла считается от последнего файла или ручного экспорта, иначе от первой записи', () => {
    expect(lastFileBackupAt({ lastAutoBackupAt: 5, lastExportAt: 9 }, 1)).toBe(9);
    expect(lastFileBackupAt({ lastAutoBackupAt: 5 }, 1)).toBe(5);
    expect(lastFileBackupAt({}, 1)).toBe(1);
  });

  it('баннер: только при включённом автосохранении, данных и наступившем сроке', () => {
    const now = at('2026-03-20T06:00:00Z');
    const s: Settings = {
      ...DEFAULT_SETTINGS,
      timeZone: TZ,
      autoBackupFrequency: 'weekly',
      lastAutoBackupAt: at('2026-03-10T06:00:00Z'),
    };
    expect(shouldOfferBackupFile(s, 1, now)).toBe(true);
    expect(shouldOfferBackupFile(s, undefined, now)).toBe(false);
    expect(shouldOfferBackupFile({ ...s, autoBackupEnabled: false }, 1, now)).toBe(false);
    expect(shouldOfferBackupFile({ ...s, autoBackupSnoozedUntil: now + 1 }, 1, now)).toBe(false);
    expect(shouldOfferBackupFile({ ...s, lastExportAt: at('2026-03-18T06:00:00Z') }, 1, now)).toBe(
      false,
    );
  });

  it('ротация оставляет самые новые копии', () => {
    const items = [3, 1, 5, 2, 4].map((n) => ({ id: `b${n}`, createdAt: n }));
    expect(snapshotsToDelete(items, 3).sort()).toEqual(['b1', 'b2']);
    expect(snapshotsToDelete(items, 10)).toEqual([]);
    // Хотя бы одна копия остаётся всегда.
    expect(snapshotsToDelete(items, 0)).toHaveLength(4);
  });

  it('имя файла — по дате в поясе пользователя', () => {
    expect(backupFileName(at('2026-03-10T19:00:00Z'), TZ)).toBe('akchakana-backup-2026-03-11.csv');
  });
});

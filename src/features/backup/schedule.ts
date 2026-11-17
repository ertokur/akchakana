import { addDays, addMonths, startOfDay } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { dayKey } from '../../domain/dates';
import type { BackupFrequency, Settings, Timestamp } from '../../domain/types';

/**
 * Когда наступает срок следующей копии после `last`: полночь (в поясе пользователя) дня,
 * отстоящего на день, неделю или календарный месяц от дня последней копии.
 * Считаем по календарным дням, чтобы копия «раз в день» не зависела от часа открытия приложения.
 */
export function nextBackupAt(
  last: Timestamp,
  frequency: BackupFrequency,
  timeZone: string,
): Timestamp {
  const day = startOfDay(toZonedTime(last, timeZone));
  const next =
    frequency === 'daily'
      ? addDays(day, 1)
      : frequency === 'weekly'
        ? addDays(day, 7)
        : addMonths(day, 1);
  return fromZonedTime(next, timeZone).getTime();
}

/** Пора ли делать копию; если копий ещё не было — пора. */
export function isBackupDue(
  last: Timestamp | undefined,
  frequency: BackupFrequency,
  now: Timestamp,
  timeZone: string,
): boolean {
  return last === undefined || now >= nextBackupAt(last, frequency, timeZone);
}

/**
 * С какого момента считать срок файла копии: последний сохранённый файл или ручной экспорт
 * (что позже); если ни того ни другого не было — первая запись в базе.
 */
export function lastFileBackupAt(
  settings: Pick<Settings, 'lastAutoBackupAt' | 'lastExportAt'>,
  oldestRecordAt: Timestamp | undefined,
): Timestamp | undefined {
  const saved = [settings.lastAutoBackupAt, settings.lastExportAt].filter(
    (t): t is number => t !== undefined,
  );
  return saved.length ? Math.max(...saved) : oldestRecordAt;
}

/** Показывать ли баннер «Пора сохранить копию». */
export function shouldOfferBackupFile(
  settings: Settings,
  oldestRecordAt: Timestamp | undefined,
  now: Timestamp,
): boolean {
  if (!settings.autoBackupEnabled || oldestRecordAt === undefined) return false;
  if (settings.autoBackupSnoozedUntil !== undefined && now < settings.autoBackupSnoozedUntil) {
    return false;
  }
  const last = lastFileBackupAt(settings, oldestRecordAt);
  return isBackupDue(last, settings.autoBackupFrequency, now, settings.timeZone);
}

/** Какие копии удалить, чтобы осталось не больше `keep` самых новых. */
export function snapshotsToDelete<T extends { id: string; createdAt: Timestamp }>(
  snapshots: T[],
  keep: number,
): string[] {
  const limit = Math.max(1, Math.floor(keep));
  return [...snapshots]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(limit)
    .map((s) => s.id);
}

export function backupFileName(now: Timestamp, timeZone: string): string {
  return `akchakana-backup-${dayKey(now, timeZone)}.csv`;
}

export const BACKUP_KEEP_OPTIONS = [3, 5, 10, 20, 30] as const;

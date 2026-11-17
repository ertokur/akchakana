import { newId } from '../../domain/ids';
import type { BackupSnapshot, BackupTarget, Timestamp } from '../../domain/types';
import { buildOwnCsv } from '../../exporters/ownCsv';
import { saveFileAs } from '../../exporters/share';
import { getRepositories } from '../../repositories';
import { useData } from '../../stores/dataStore';
import { backupFileName, isBackupDue, snapshotsToDelete } from './schedule';

function currentCsv(): { csv: string; transactions: number; hasData: boolean } {
  const s = useData.getState();
  const csv = buildOwnCsv(s, s.settings.timeZone);
  return {
    csv,
    transactions: s.transactions.length,
    hasData: s.accounts.length > 0 || s.transactions.length > 0,
  };
}

/** Просим браузер не удалять данные при нехватке места (Chrome обычно соглашается для PWA). */
export function requestPersistentStorage(): void {
  try {
    void navigator.storage?.persist?.().catch(() => undefined);
  } catch {
    // Storage API недоступен.
  }
}

/** Сохраняет внутреннюю копию и удаляет лишние старые. */
export async function createSnapshot(now: Timestamp = Date.now()): Promise<BackupSnapshot | null> {
  const { csv, transactions, hasData } = currentCsv();
  if (!hasData) return null;
  const { settings, updateSettings } = useData.getState();
  const repos = getRepositories();
  const snapshot: BackupSnapshot = {
    id: newId(),
    createdAt: now,
    fileName: backupFileName(now, settings.timeZone),
    content: csv,
    size: new TextEncoder().encode(csv).length,
    transactions,
  };
  await repos.backups.put(snapshot);
  const stale = snapshotsToDelete(await repos.backups.list(), settings.autoBackupKeep);
  if (stale.length) await repos.backups.bulkDelete(stale);
  await updateSettings({ lastSnapshotAt: now });
  return snapshot;
}

/** Внутренняя копия по расписанию: вызывается планировщиком, ничего не спрашивает у пользователя. */
export async function runSnapshotIfDue(now: Timestamp = Date.now()): Promise<boolean> {
  const { settings } = useData.getState();
  if (!settings.autoBackupEnabled) return false;
  if (!isBackupDue(settings.lastSnapshotAt, settings.autoBackupFrequency, now, settings.timeZone)) {
    return false;
  }
  return (await createSnapshot(now)) !== null;
}

/** Применяет новое значение «сколько копий хранить» к уже сохранённым копиям. */
export async function pruneSnapshots(keep: number): Promise<void> {
  const repos = getRepositories();
  const stale = snapshotsToDelete(await repos.backups.list(), keep);
  if (stale.length) await repos.backups.bulkDelete(stale);
}

export type SaveResult = 'shared' | 'saved' | 'downloaded' | 'cancelled';

/**
 * Сохранить файл копии туда, куда выберет пользователь (только по нажатию).
 * Заодно делает свежую внутреннюю копию и отмечает дату — расписание считается от неё.
 */
export async function saveBackupFile(
  method?: BackupTarget,
  now: Timestamp = Date.now(),
): Promise<SaveResult> {
  const { settings, updateSettings } = useData.getState();
  const { csv } = currentCsv();
  requestPersistentStorage();
  const result = await saveFileAs(
    csv,
    backupFileName(now, settings.timeZone),
    method ?? settings.autoBackupTarget,
  );
  if (result === 'cancelled') return result;
  await createSnapshot(now);
  await updateSettings({
    lastAutoBackupAt: now,
    lastExportAt: now,
    exportSnoozedUntil: undefined,
    autoBackupSnoozedUntil: undefined,
  });
  return result;
}

export const SAVE_RESULT_TEXT: Record<Exclude<SaveResult, 'cancelled'>, string> = {
  shared: 'Копия передана',
  saved: 'Копия сохранена',
  downloaded: 'Копия сохранена в «Загрузки»',
};

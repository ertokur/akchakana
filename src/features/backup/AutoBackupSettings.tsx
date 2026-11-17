import { useEffect, useState } from 'react';
import { DatabaseBackup, Download } from 'lucide-react';
import { formatDate } from '../../domain/dates';
import { numberSeparators } from '../../domain/money';
import type { BackupFrequency, BackupSnapshot, BackupTarget } from '../../domain/types';
import { fileShareSupported, saveDialogSupported, saveFileAs } from '../../exporters/share';
import { t as tr, useT } from '../../i18n';
import { getRepositories } from '../../repositories';
import { useData } from '../../stores/dataStore';
import { useUi } from '../../stores/uiStore';
import { Button, Field, IconButton, SegmentedControl, Select, Toggle } from '../../ui/controls';
import { pruneSnapshots, requestPersistentStorage, saveBackupFile, saveResultText } from './backup';
import { BACKUP_KEEP_OPTIONS, nextBackupAt } from './schedule';

export function formatSize(bytes: number): string {
  if (bytes < 1024) return tr('size.b', { n: bytes });
  if (bytes < 1024 * 1024) return tr('size.kb', { n: Math.round(bytes / 1024) });
  return tr('size.mb', {
    n: (bytes / 1024 / 1024).toFixed(1).replace('.', numberSeparators().decimal),
  });
}

/** Раздел «Резервные копии» в настройках. */
export function AutoBackupSettings() {
  const t = useT();
  const settings = useData((s) => s.settings);
  const updateSettings = useData((s) => s.updateSettings);
  const toast = useUi((s) => s.toast);
  const [snapshots, setSnapshots] = useState<BackupSnapshot[]>([]);
  const [busy, setBusy] = useState(false);
  const tz = settings.timeZone;
  const fmt = (ts: number) => formatDate(ts, tz, 'dayMonthYearTime');

  // Список перечитывается после новой копии и после ротации.
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);
  useEffect(() => {
    let cancelled = false;
    void getRepositories()
      .backups.list()
      .then((list) => {
        if (!cancelled) setSnapshots(list);
      });
    return () => {
      cancelled = true;
    };
  }, [version, settings.lastSnapshotAt]);

  const lastFile = settings.lastAutoBackupAt;
  const canShare = fileShareSupported();
  const hasSaveDialog = saveDialogSupported();

  const saveNow = async () => {
    setBusy(true);
    try {
      const result = await saveBackupFile();
      if (result !== 'cancelled') toast({ text: saveResultText(result) });
    } catch (e) {
      toast({ text: t('backup.failed', { error: (e as Error).message }), tone: 'error' });
    } finally {
      setBusy(false);
      reload();
    }
  };

  const saveSnapshot = async (s: BackupSnapshot) => {
    const result = await saveFileAs(s.content, s.fileName, settings.autoBackupTarget);
    if (result !== 'cancelled') toast({ text: saveResultText(result) });
  };

  return (
    <section
      aria-labelledby="backup-heading"
      className="flex flex-col gap-3 rounded-2xl bg-surface p-4"
    >
      <h2 id="backup-heading" className="flex items-center gap-2 font-semibold">
        <DatabaseBackup size={18} aria-hidden="true" /> {t('backup.title')}
      </h2>
      <Toggle
        checked={settings.autoBackupEnabled}
        onChange={(on) => {
          if (on) requestPersistentStorage();
          void updateSettings({ autoBackupEnabled: on });
        }}
        label={t('backup.auto')}
        description={t('backup.autoHint')}
      />

      {settings.autoBackupEnabled && (
        <>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-muted">{t('backup.frequency')}</span>
            <SegmentedControl<BackupFrequency>
              label={t('backup.frequency')}
              size="sm"
              value={settings.autoBackupFrequency}
              options={[
                { value: 'daily', label: t('backup.daily') },
                { value: 'weekly', label: t('backup.weekly') },
                { value: 'monthly', label: t('backup.monthly') },
              ]}
              onChange={(autoBackupFrequency) => void updateSettings({ autoBackupFrequency })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-muted">{t('backup.target')}</span>
            <SegmentedControl<BackupTarget>
              label={t('backup.target')}
              size="sm"
              value={settings.autoBackupTarget}
              options={[
                { value: 'share', label: t('backup.targetShare') },
                {
                  value: 'download',
                  label: hasSaveDialog ? t('backup.targetFolder') : t('backup.targetDownloads'),
                },
              ]}
              onChange={(autoBackupTarget) => void updateSettings({ autoBackupTarget })}
            />
            <p className="text-sm text-muted">
              {settings.autoBackupTarget === 'share'
                ? canShare
                  ? t('backup.hintShare')
                  : t('backup.hintNoShare')
                : hasSaveDialog
                  ? t('backup.hintFolder')
                  : t('backup.hintDownloads')}
            </p>
          </div>
          <Field label={t('backup.keep')}>
            {(id) => (
              <Select
                id={id}
                value={settings.autoBackupKeep}
                onChange={async (e) => {
                  const keep = Number(e.target.value);
                  await updateSettings({ autoBackupKeep: keep });
                  await pruneSnapshots(keep);
                  reload();
                }}
              >
                {BACKUP_KEEP_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </>
      )}

      <div className="text-sm text-muted">
        <p>{lastFile ? t('backup.lastFile', { date: fmt(lastFile) }) : t('backup.noFile')}</p>
        {settings.autoBackupEnabled && lastFile && (
          <p>
            {t('backup.next', {
              date: formatDate(
                nextBackupAt(lastFile, settings.autoBackupFrequency, tz),
                tz,
                'dayMonthYear',
              ),
            })}
          </p>
        )}
      </div>

      <Button block disabled={busy} onClick={saveNow}>
        <Download size={20} aria-hidden="true" /> {t('backup.saveNow')}
      </Button>

      {snapshots.length > 0 && (
        <div>
          <h3 className="mb-1 text-sm font-medium text-muted">{t('backup.snapshots')}</h3>
          <ul aria-label={t('backup.snapshots')} className="flex flex-col">
            {snapshots.map((s) => (
              <li key={s.id} className="flex min-h-11 items-center gap-2">
                <span className="flex-1 text-sm">
                  {fmt(s.createdAt)}
                  <span className="block text-muted">
                    {t('backup.snapshotInfo', { count: s.transactions, size: formatSize(s.size) })}
                  </span>
                </span>
                <IconButton
                  label={t('backup.saveSnapshot', { date: fmt(s.createdAt) })}
                  onClick={() => void saveSnapshot(s)}
                >
                  <Download size={18} aria-hidden="true" />
                </IconButton>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-sm text-muted">{t('backup.explain')}</p>
    </section>
  );
}

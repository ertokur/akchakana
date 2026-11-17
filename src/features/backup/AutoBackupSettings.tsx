import { useEffect, useState } from 'react';
import { DatabaseBackup, Download } from 'lucide-react';
import { formatInTz } from '../../domain/dates';
import type { BackupFrequency, BackupSnapshot, BackupTarget } from '../../domain/types';
import { fileShareSupported, saveDialogSupported, saveFileAs } from '../../exporters/share';
import { getRepositories } from '../../repositories';
import { useData } from '../../stores/dataStore';
import { useUi } from '../../stores/uiStore';
import { Button, Field, IconButton, SegmentedControl, Select, Toggle } from '../../ui/controls';
import {
  pruneSnapshots,
  requestPersistentStorage,
  SAVE_RESULT_TEXT,
  saveBackupFile,
} from './backup';
import { BACKUP_KEEP_OPTIONS, nextBackupAt } from './schedule';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} МБ`;
}

/** Раздел «Резервные копии» в настройках. */
export function AutoBackupSettings() {
  const settings = useData((s) => s.settings);
  const updateSettings = useData((s) => s.updateSettings);
  const toast = useUi((s) => s.toast);
  const [snapshots, setSnapshots] = useState<BackupSnapshot[]>([]);
  const [busy, setBusy] = useState(false);
  const tz = settings.timeZone;
  const fmt = (ts: number) => formatInTz(ts, tz, 'd MMMM yyyy, HH:mm');

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
      if (result !== 'cancelled') toast({ text: SAVE_RESULT_TEXT[result] });
    } catch (e) {
      toast({ text: `Не удалось сохранить копию: ${(e as Error).message}`, tone: 'error' });
    } finally {
      setBusy(false);
      reload();
    }
  };

  const saveSnapshot = async (s: BackupSnapshot) => {
    const result = await saveFileAs(s.content, s.fileName, settings.autoBackupTarget);
    if (result !== 'cancelled') toast({ text: SAVE_RESULT_TEXT[result] });
  };

  return (
    <section
      aria-labelledby="backup-heading"
      className="flex flex-col gap-3 rounded-2xl bg-surface p-4"
    >
      <h2 id="backup-heading" className="flex items-center gap-2 font-semibold">
        <DatabaseBackup size={18} aria-hidden="true" /> Резервные копии
      </h2>
      <Toggle
        checked={settings.autoBackupEnabled}
        onChange={(on) => {
          if (on) requestPersistentStorage();
          void updateSettings({ autoBackupEnabled: on });
        }}
        label="Автосохранение"
        description="Копия внутри приложения по расписанию и напоминание сохранить файл"
      />

      {settings.autoBackupEnabled && (
        <>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-muted">Как часто</span>
            <SegmentedControl<BackupFrequency>
              label="Как часто"
              size="sm"
              value={settings.autoBackupFrequency}
              options={[
                { value: 'daily', label: 'Ежедневно' },
                { value: 'weekly', label: 'Еженедельно' },
                { value: 'monthly', label: 'Ежемесячно' },
              ]}
              onChange={(autoBackupFrequency) => void updateSettings({ autoBackupFrequency })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-muted">Куда сохранять файл</span>
            <SegmentedControl<BackupTarget>
              label="Куда сохранять файл"
              size="sm"
              value={settings.autoBackupTarget}
              options={[
                { value: 'share', label: 'Выбрать приложение' },
                { value: 'download', label: hasSaveDialog ? 'Выбрать папку' : 'В «Загрузки»' },
              ]}
              onChange={(autoBackupTarget) => void updateSettings({ autoBackupTarget })}
            />
            <p className="text-sm text-muted">
              {settings.autoBackupTarget === 'share'
                ? canShare
                  ? 'Откроется меню «Поделиться»: Google Диск, «Файлы» (на iPhone — «Сохранить в Файлы»), Telegram и т. п.'
                  : 'Этот браузер не умеет делиться файлами — файл будет скачан.'
                : hasSaveDialog
                  ? 'Браузер спросит, в какую папку и под каким именем сохранить файл.'
                  : 'Файл скачается в папку «Загрузки» (Download) в памяти телефона.'}
            </p>
          </div>
          <Field label="Хранить копий внутри приложения">
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
        <p>
          {lastFile ? `Последний файл копии: ${fmt(lastFile)}` : 'Файл копии ещё не сохранялся.'}
        </p>
        {settings.autoBackupEnabled && lastFile && (
          <p>
            Следующее напоминание:{' '}
            {formatInTz(
              nextBackupAt(lastFile, settings.autoBackupFrequency, tz),
              tz,
              'd MMMM yyyy',
            )}
          </p>
        )}
      </div>

      <Button block disabled={busy} onClick={saveNow}>
        <Download size={20} aria-hidden="true" /> Сохранить копию сейчас
      </Button>

      {snapshots.length > 0 && (
        <div>
          <h3 className="mb-1 text-sm font-medium text-muted">Копии внутри приложения</h3>
          <ul aria-label="Копии внутри приложения" className="flex flex-col">
            {snapshots.map((s) => (
              <li key={s.id} className="flex min-h-11 items-center gap-2">
                <span className="flex-1 text-sm">
                  {fmt(s.createdAt)}
                  <span className="block text-muted">
                    операций: {s.transactions} · {formatSize(s.size)}
                  </span>
                </span>
                <IconButton
                  label={`Сохранить копию от ${fmt(s.createdAt)}`}
                  onClick={() => void saveSnapshot(s)}
                >
                  <Download size={18} aria-hidden="true" />
                </IconButton>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-sm text-muted">
        Браузер не разрешает веб-приложению самому записывать файлы в память телефона, поэтому файл
        копии сохраняется по вашему нажатию — туда, куда вы выберете. Копии внутри приложения
        делаются сами, но хранятся в том же браузере: если очистить данные сайта или удалить
        браузер, они пропадут вместе с остальными данными. Восстановить данные из файла: «Импорт» →
        выбрать файл копии.
      </p>
    </section>
  );
}

import { DatabaseBackup } from 'lucide-react';
import { navigate } from '../../app/router';
import { useData } from '../../stores/dataStore';
import { Button } from '../../ui/controls';
import { useNow } from '../shared/hooks';

const MONTH_MS = 30 * 86_400_000;

/** Нужно ли напомнить об экспорте: прошло больше 30 дней с последнего (или с первой записи). */
export function shouldRemindExport(
  lastExportAt: number | undefined,
  snoozedUntil: number | undefined,
  oldestRecordAt: number | undefined,
  now: number,
): boolean {
  if (snoozedUntil !== undefined && now < snoozedUntil) return false;
  const since = lastExportAt ?? oldestRecordAt;
  return since !== undefined && now - since > MONTH_MS;
}

/** Браузер может очистить IndexedDB, поэтому раз в месяц напоминаем сохранить копию. */
export function ExportReminder() {
  const settings = useData((s) => s.settings);
  const transactions = useData((s) => s.transactions);
  const updateSettings = useData((s) => s.updateSettings);
  const now = useNow();
  const oldest = transactions.reduce<number | undefined>(
    (min, t) => (min === undefined || t.createdAt < min ? t.createdAt : min),
    undefined,
  );
  if (!shouldRemindExport(settings.lastExportAt, settings.exportSnoozedUntil, oldest, now)) {
    return null;
  }
  return (
    <section
      aria-label="Напоминание об экспорте"
      className="mb-4 rounded-2xl border border-warning bg-surface p-3"
    >
      <div className="flex gap-2">
        <DatabaseBackup size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-warning" />
        <p className="text-sm">
          Данные хранятся только в браузере, и он может их очистить. Сохраните резервную копию — это
          займёт минуту.
        </p>
      </div>
      <div className="mt-2 flex gap-2">
        <Button className="flex-1" onClick={() => navigate('export')}>
          Экспортировать
        </Button>
        <Button
          variant="secondary"
          onClick={() => updateSettings({ exportSnoozedUntil: now + 7 * 86_400_000 })}
        >
          Через неделю
        </Button>
      </div>
    </section>
  );
}

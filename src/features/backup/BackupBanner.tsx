import { useState } from 'react';
import { DatabaseBackup } from 'lucide-react';
import { useData } from '../../stores/dataStore';
import { useUi } from '../../stores/uiStore';
import { Button } from '../../ui/controls';
import { useNow } from '../shared/hooks';
import { saveBackupFile, saveResultText } from './backup';
import { useT } from '../../i18n';
import { shouldOfferBackupFile } from './schedule';

const DAY_MS = 86_400_000;

/**
 * Когда подошёл срок, предлагает сохранить файл копии. Браузеры не дают записать файл
 * в память телефона без нажатия, поэтому место выбирает пользователь: меню «Поделиться»
 * (Google Диск, «Файлы») или скачивание.
 */
export function BackupBanner() {
  const t = useT();
  const settings = useData((s) => s.settings);
  const transactions = useData((s) => s.transactions);
  const accounts = useData((s) => s.accounts);
  const updateSettings = useData((s) => s.updateSettings);
  const toast = useUi((s) => s.toast);
  const now = useNow();
  const [busy, setBusy] = useState(false);
  const oldest = [...transactions, ...accounts].reduce<number | undefined>(
    (min, r) => (min === undefined || r.createdAt < min ? r.createdAt : min),
    undefined,
  );
  if (!shouldOfferBackupFile(settings, oldest, now)) return null;

  const save = async () => {
    setBusy(true);
    try {
      const result = await saveBackupFile();
      if (result !== 'cancelled') toast({ text: saveResultText(result) });
    } catch (e) {
      toast({ text: t('backup.failed', { error: (e as Error).message }), tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-label={t('backup.bannerLabel')}
      className="mb-4 rounded-2xl border border-accent bg-surface p-3"
    >
      <div className="flex gap-2">
        <DatabaseBackup size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-accent" />
        <p className="text-sm">{t('backup.banner')}</p>
      </div>
      <div className="mt-2 flex gap-2">
        <Button className="flex-1" disabled={busy} onClick={save}>
          {t('backup.save')}
        </Button>
        <Button
          variant="secondary"
          onClick={() => updateSettings({ autoBackupSnoozedUntil: now + DAY_MS })}
        >
          {t('backup.tomorrow')}
        </Button>
      </div>
    </section>
  );
}

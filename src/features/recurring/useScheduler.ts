import { useEffect } from 'react';
import { useUi } from '../../stores/uiStore';
import { runSnapshotIfDue } from '../backup/backup';
import { runScheduler } from './scheduler';
import { t } from '../../i18n';

/**
 * Запускает обработку повторов и внутреннюю резервную копию по расписанию:
 * при старте, при возврате в приложение и раз в минуту.
 */
export function useScheduler(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    let running = false;
    const run = async () => {
      if (running || document.visibilityState === 'hidden') return;
      running = true;
      try {
        const created = await runScheduler();
        if (created > 0) {
          useUi.getState().toast({ text: t('recurring.autoAdded', { count: created }) });
        }
        try {
          await runSnapshotIfDue();
        } catch {
          // Нет места или база недоступна — попробуем при следующем запуске.
        }
      } finally {
        running = false;
      }
    };
    void run();
    const timer = setInterval(run, 60_000);
    document.addEventListener('visibilitychange', run);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', run);
    };
  }, [enabled]);
}

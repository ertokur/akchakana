import { useEffect } from 'react';
import { useUi } from '../../stores/uiStore';
import { runScheduler } from './scheduler';

/** Запускает обработку повторов при старте, при возврате в приложение и раз в минуту. */
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
          useUi.getState().toast({ text: `Добавлено регулярных операций: ${created}` });
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

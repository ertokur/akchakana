import { useT } from '../i18n';

/** Подпись авторов с бьющимся сердцем (внизу вкладки «Ещё» и на экране первого запуска). */
export function MadeWith({ className = 'mt-auto pt-8 pb-2' }: { className?: string }) {
  const t = useT();
  return (
    <div className={`flex justify-center ${className}`}>
      <p
        role="note"
        aria-label="Made by Erbol Tokur and Claude with love"
        className="flex items-center justify-center gap-x-1 rounded-2xl border border-accent-soft bg-accent-soft/60 px-4 py-3 text-center text-[0.8125rem] whitespace-nowrap text-muted shadow-sm"
      >
        <span>Made by</span>
        <span className="font-semibold text-accent-strong">Erbol Tokur</span>
        <span>and</span>
        <span className="font-semibold text-accent-strong">Claude</span>
        <span>with</span>
        <span
          className="animate-heartbeat inline-block text-lg leading-none"
          role="img"
          aria-label={t('madeWith.love')}
        >
          ❤️
        </span>
      </p>
    </div>
  );
}

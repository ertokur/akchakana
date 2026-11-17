/** Подпись авторов внизу вкладки «Ещё» с бьющимся сердцем. */
export function MadeWith() {
  return (
    <footer className="mt-auto flex justify-center pt-8 pb-2">
      <p className="flex items-center justify-center gap-x-1 rounded-2xl border border-accent-soft bg-accent-soft/60 px-4 py-3 text-center text-[0.8125rem] whitespace-nowrap text-muted shadow-sm">
        <span>Made by</span>
        <span className="font-semibold text-accent-strong">Erbol Tokur</span>
        <span>and</span>
        <span className="font-semibold text-accent-strong">Claude</span>
        <span>with</span>
        <span
          className="animate-heartbeat inline-block text-lg leading-none"
          role="img"
          aria-label="любовью"
        >
          ❤️
        </span>
      </p>
    </footer>
  );
}

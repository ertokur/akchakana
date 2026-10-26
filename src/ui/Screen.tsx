import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { IconButton } from './controls';

/** Каркас экрана: шапка с учётом выреза (notch) и прокручиваемое содержимое над нижней навигацией. */
export function Screen({
  title,
  actions,
  onBack,
  header,
  children,
}: {
  title: string;
  actions?: ReactNode;
  onBack?: () => void;
  header?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="pt-safe pl-safe pr-safe sticky top-0 z-20 border-b border-border bg-bg/95 backdrop-blur">
        <div className="mx-auto flex min-h-14 max-w-lg items-center gap-1 px-2 py-1">
          {onBack ? (
            <IconButton label="Назад" onClick={onBack}>
              <ChevronLeft />
            </IconButton>
          ) : (
            <span className="w-3" />
          )}
          <h1 className="flex-1 truncate text-xl font-bold">{title}</h1>
          {actions}
        </div>
        {header && <div className="mx-auto max-w-lg px-4 pb-3">{header}</div>}
      </header>
      <main className="pl-safe pr-safe mx-auto w-full max-w-lg flex-1 px-4 pt-3 pb-[calc(6rem+env(safe-area-inset-bottom))]">
        {children}
      </main>
    </div>
  );
}

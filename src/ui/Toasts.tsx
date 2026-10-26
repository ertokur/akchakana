import { useEffect } from 'react';
import { useUi, type ToastMessage } from '../stores/uiStore';

function ToastItem({ toast }: { toast: ToastMessage }) {
  const dismiss = useUi((s) => s.dismissToast);
  useEffect(() => {
    const timer = setTimeout(
      () => dismiss(toast.id),
      toast.duration ?? (toast.action ? 5000 : 3000),
    );
    return () => clearTimeout(timer);
  }, [toast, dismiss]);
  const tone =
    toast.tone === 'warning'
      ? 'border-l-4 border-warning'
      : toast.tone === 'error'
        ? 'border-l-4 border-expense'
        : '';
  return (
    <div
      role={toast.tone === 'error' ? 'alert' : 'status'}
      className={`animate-fade-in pointer-events-auto flex min-h-12 items-center gap-3 rounded-xl bg-text px-4 py-2 text-bg shadow-lg ${tone}`}
    >
      <span className="flex-1">{toast.text}</span>
      {toast.action && (
        <button
          type="button"
          className="min-h-11 rounded-lg px-3 font-semibold text-accent-soft underline-offset-2 hover:underline"
          onClick={() => {
            toast.action!.run();
            dismiss(toast.id);
          }}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  );
}

export function Toasts() {
  const toasts = useUi((s) => s.toasts);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-lg flex-col gap-2 px-4"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}

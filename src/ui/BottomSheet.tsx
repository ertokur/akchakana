import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { IconButton } from './controls';

/** Стек открытых шторок: Escape закрывает только верхнюю. */
const sheetStack: symbol[] = [];

/**
 * Нижняя шторка. Закрывается кнопкой, Escape, тапом по фону и свайпом вниз за «ручку».
 * Анимация — только transform, чтобы не нагружать слабые устройства.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
  headerExtra,
  tall = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  headerExtra?: ReactNode;
  tall?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; dy: number } | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const token = Symbol('sheet');
    sheetStack.push(token);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && sheetStack[sheetStack.length - 1] === token) {
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      sheetStack.splice(sheetStack.indexOf(token), 1);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { startY: e.clientY, dy: 0 };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || !panelRef.current) return;
    drag.current.dy = Math.max(0, e.clientY - drag.current.startY);
    panelRef.current.style.transform = `translateY(${drag.current.dy}px)`;
  };
  const onPointerUp = () => {
    if (!drag.current || !panelRef.current) return;
    const { dy } = drag.current;
    drag.current = null;
    if (dy > 100) onClose();
    else panelRef.current.style.transform = '';
  };

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <div
        className="animate-fade-in absolute inset-0 bg-overlay"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`animate-sheet-in pb-safe relative flex w-full max-w-lg flex-col rounded-t-3xl bg-surface shadow-2xl transition-transform duration-150 will-change-transform focus:outline-none ${tall ? 'h-[94dvh]' : 'max-h-[94dvh]'}`}
      >
        <div
          className="flex cursor-grab touch-none justify-center pt-2 pb-1"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <span className="h-1.5 w-10 rounded-full bg-border" />
        </div>
        <div className="flex items-center gap-2 px-4 pb-2">
          <h2 className="flex-1 truncate text-lg font-semibold">{title}</h2>
          {headerExtra}
          <IconButton label="Закрыть" onClick={onClose}>
            <X size={22} />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
          {children}
        </div>
        {footer && <div className="border-t border-border px-4 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Окно подтверждения поверх всего. */
export function ConfirmDialog({
  open,
  title,
  text,
  confirmLabel = 'Удалить',
  danger = true,
  onConfirm,
  onCancel,
  children,
  confirmDisabled,
}: {
  open: boolean;
  title: string;
  text?: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
  confirmDisabled?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="animate-fade-in absolute inset-0 bg-overlay" onClick={onCancel} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="animate-fade-in relative w-full max-w-sm rounded-2xl bg-surface p-5 shadow-2xl"
      >
        <h2 className="text-lg font-semibold">{title}</h2>
        {text && <p className="mt-2 text-muted">{text}</p>}
        {children && <div className="mt-3">{children}</div>}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="min-h-11 rounded-xl px-4 font-semibold text-accent hover:bg-accent-soft"
            onClick={onCancel}
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={confirmDisabled}
            className={`min-h-11 rounded-xl px-4 font-semibold disabled:opacity-50 ${danger ? 'bg-expense text-white' : 'bg-accent text-accent-fg'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

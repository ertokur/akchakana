import { useRef, type PointerEvent as ReactPointerEvent } from 'react';

/**
 * Свайп влево для удаления. Двигаем элемент через transform напрямую (без ререндеров),
 * вертикальная прокрутка не блокируется: жест захватывается только при явном горизонтальном движении.
 */
export function useSwipeToDelete(onDelete: () => void, threshold = 0.4) {
  const ref = useRef<HTMLDivElement>(null);
  const state = useRef<{ x: number; y: number; dx: number; active: boolean; id: number } | null>(
    null,
  );
  const swiped = useRef(false);

  const reset = (animate = true) => {
    const el = ref.current;
    if (!el) return;
    el.style.transition = animate ? 'transform 150ms ease-out' : '';
    el.style.transform = '';
  };

  return {
    ref,
    /** true, если последний жест был свайпом — чтобы не открывать операцию по клику. */
    wasSwiped: () => swiped.current,
    handlers: {
      onPointerDown(e: ReactPointerEvent) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        state.current = { x: e.clientX, y: e.clientY, dx: 0, active: false, id: e.pointerId };
        swiped.current = false;
      },
      onPointerMove(e: ReactPointerEvent) {
        const s = state.current;
        const el = ref.current;
        if (!s || !el) return;
        const dx = e.clientX - s.x;
        const dy = e.clientY - s.y;
        if (!s.active) {
          if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.5 && dx < 0) {
            s.active = true;
            el.setPointerCapture?.(s.id);
          } else if (Math.abs(dy) > 10) {
            state.current = null;
            return;
          } else return;
        }
        s.dx = Math.min(0, dx);
        el.style.transition = '';
        el.style.transform = `translateX(${s.dx}px)`;
      },
      onPointerUp() {
        const s = state.current;
        const el = ref.current;
        state.current = null;
        if (!s || !el || !s.active) return;
        swiped.current = true;
        if (Math.abs(s.dx) > el.offsetWidth * threshold) {
          el.style.transition = 'transform 150ms ease-out';
          el.style.transform = 'translateX(-100%)';
          setTimeout(() => {
            onDelete();
            reset(false);
          }, 150);
        } else {
          reset();
        }
      },
      onPointerCancel() {
        state.current = null;
        reset();
      },
    },
  };
}

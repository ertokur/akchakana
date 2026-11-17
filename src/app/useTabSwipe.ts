import { useEffect } from 'react';
import { navigate, type Route } from './router';

/**
 * Свайп влево/вправо по экрану переключает соседние вкладки нижней навигации.
 *
 * Жест не перехватывает ничего у других элементов: слушаем touch-события пассивно и решаем
 * только в конце касания. Не срабатывает, если касание началось:
 *  - в открытой шторке или диалоге, в поле ввода, на графике;
 *  - на элементе с `data-swipe-ignore` (значение `left`/`right` — только для этого направления:
 *    у строки операции свой свайп влево для удаления, вправо вкладки листаются);
 *  - внутри горизонтально прокручиваемой ленты (подкатегории, доходы на «Счетах»);
 *  - у самого края экрана (системный жест «назад»).
 * Также не срабатывает, если за время касания страница прокрутилась по вертикали.
 */

/** Вкладки в порядке нижней навигации и экраны, которые к ним относятся. */
export const TAB_ORDER: { route: Route; screens: Route[] }[] = [
  { route: 'accounts', screens: ['accounts', 'debts'] },
  { route: 'home', screens: ['home'] },
  { route: 'transactions', screens: ['transactions'] },
  { route: 'stats', screens: ['stats'] },
  { route: 'more', screens: ['more'] },
];

export type SwipeDirection = 'left' | 'right';

/** Соседняя вкладка; null — края списка или экран не является вкладкой (настройки, импорт…). */
export function adjacentTab(current: Route, direction: SwipeDirection): Route | null {
  const index = TAB_ORDER.findIndex((t) => t.screens.includes(current));
  if (index < 0) return null;
  // Свайп влево (палец справа налево) — следующая вкладка, как перелистывание страницы.
  const next = TAB_ORDER[index + (direction === 'left' ? 1 : -1)];
  return next ? next.route : null;
}

export interface SwipeGesture {
  dx: number;
  dy: number;
  /** Длительность касания, мс. */
  dt: number;
  /** Ширина экрана, px. */
  width: number;
}

/** Решение по завершённому касанию: явно горизонтальное, достаточно длинное или быстрое. */
export function swipeDirection({ dx, dy, dt, width }: SwipeGesture): SwipeDirection | null {
  const distance = Math.abs(dx);
  if (distance < Math.abs(dy) * 2) return null;
  if (dt > 800) return null;
  const long = distance >= Math.min(120, width * 0.3);
  const fast = distance >= 50 && distance / Math.max(dt, 1) >= 0.4;
  if (!long && !fast) return null;
  return dx < 0 ? 'left' : 'right';
}

const IGNORE_SELECTOR = [
  'input',
  'textarea',
  'select',
  '[contenteditable]',
  'canvas',
  '[role="dialog"]',
  '[role="alertdialog"]',
].join(',');

/**
 * Какие направления свайпа принадлежат элементу под пальцем:
 * 'all' — оба, 'left'/'right' — одно, null — жест свободен для вкладок.
 */
export function swipeBlock(target: EventTarget | null): SwipeDirection | 'all' | null {
  if (!(target instanceof Element)) return 'all';
  if (target.closest(IGNORE_SELECTOR)) return 'all';
  for (let el: Element | null = target; el && el !== document.body; el = el.parentElement) {
    if (el.scrollWidth > el.clientWidth + 1) {
      const overflow = getComputedStyle(el).overflowX;
      if (overflow === 'auto' || overflow === 'scroll') return 'all';
    }
  }
  const marked = target.closest('[data-swipe-ignore]')?.getAttribute('data-swipe-ignore');
  if (marked === undefined || marked === null) return null;
  return marked === 'left' || marked === 'right' ? marked : 'all';
}

const EDGE = 24;

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/** Номер текущего анимированного перехода; 0 — перехода нет, свайпы принимаются. */
let activeTransition = 0;
let transitionCounter = 0;

/** Переход с лёгкой анимацией (View Transitions, где поддерживается). */
function go(route: Route, direction: SwipeDirection) {
  const doc = document as Document & {
    startViewTransition?: (cb: () => Promise<void>) => unknown;
  };
  if (!doc.startViewTransition || prefersReducedMotion() || document.hidden) {
    navigate(route);
    return;
  }
  if (activeTransition) return;
  const id = ++transitionCounter;
  activeTransition = id;
  const root = document.documentElement;
  root.dataset.tabSwipe = direction;
  let navigated = false;
  const cleanup = () => {
    // Завершение старого перехода не должно снимать флаг нового.
    if (activeTransition !== id) return;
    activeTransition = 0;
    delete root.dataset.tabSwipe;
  };
  const transition = doc.startViewTransition(
    () =>
      new Promise<void>((resolve) => {
        // Новый экран рисуется после hashchange; ждём его и даём React отрисовать.
        const done = () => {
          window.removeEventListener('hashchange', done);
          setTimeout(resolve, 0);
        };
        window.addEventListener('hashchange', done);
        setTimeout(done, 300);
        navigated = true;
        navigate(route);
      }),
  ) as { finished?: Promise<void> } | undefined;
  if (transition?.finished) void transition.finished.finally(cleanup);
  // Страховка: если браузер так и не начал переход (кадры не рисуются),
  // переходим без анимации и не блокируем следующие свайпы.
  setTimeout(() => {
    if (!navigated) navigate(route);
    cleanup();
  }, 700);
}

/** Включает свайпы между вкладками, пока `enabled` (нет онбординга и блокировки). */
export function useTabSwipe(route: Route, enabled: boolean) {
  useEffect(() => {
    if (!enabled || !TAB_ORDER.some((t) => t.screens.includes(route))) return;
    let start: {
      x: number;
      y: number;
      time: number;
      scrollY: number;
      blocked: SwipeDirection | null;
    } | null = null;

    const onStart = (e: TouchEvent) => {
      start = null;
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      if (touch.clientX < EDGE || touch.clientX > window.innerWidth - EDGE) return;
      const block = swipeBlock(e.target);
      if (block === 'all') return;
      // Открытая шторка перекрывает экран, даже если касание пришлось на подложку.
      if (document.querySelector('[role="dialog"],[role="alertdialog"]')) return;
      start = {
        x: touch.clientX,
        y: touch.clientY,
        time: e.timeStamp,
        scrollY: window.scrollY,
        blocked: block,
      };
    };
    const onEnd = (e: TouchEvent) => {
      const s = start;
      start = null;
      if (!s || e.changedTouches.length !== 1) return;
      if (Math.abs(window.scrollY - s.scrollY) > 10) return;
      const touch = e.changedTouches[0];
      const direction = swipeDirection({
        dx: touch.clientX - s.x,
        dy: touch.clientY - s.y,
        dt: e.timeStamp - s.time,
        width: window.innerWidth,
      });
      if (!direction || direction === s.blocked) return;
      // Выделение текста пальцем — не свайп.
      if (window.getSelection?.()?.toString()) return;
      const next = adjacentTab(route, direction);
      if (next) go(next, direction);
    };
    const onCancel = () => (start = null);

    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    window.addEventListener('touchcancel', onCancel, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onCancel);
    };
  }, [route, enabled]);
}

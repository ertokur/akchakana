import { useRef } from 'react';
import { formatMoney } from '../../domain/money';
import type { BudgetStatus } from '../../domain/budgets';
import type { Category } from '../../domain/types';
import { Icon } from '../../ui/Icon';

const SIZE = 52;

/** Пузырь категории: название, круг с иконкой (и прогрессом бюджета), сумма за период. */
export function CategoryBubble({
  category,
  amount,
  currency,
  budget,
  editing,
  onTap,
  onLongPress,
}: {
  category: Category;
  amount: number;
  currency: string;
  budget?: BudgetStatus;
  editing: boolean;
  onTap: () => void;
  onLongPress: () => void;
}) {
  const timer = useRef<number | null>(null);
  const longPressed = useRef(false);
  const start = useRef<{ x: number; y: number } | null>(null);

  const cancel = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };

  const r = SIZE / 2 + 3;
  const circumference = 2 * Math.PI * r;
  const ratio = budget ? Math.min(budget.ratio, 1) : 0;
  const budgetColor =
    budget?.level === 'over'
      ? 'var(--app-expense)'
      : budget?.level === 'warning'
        ? 'var(--app-warning)'
        : 'var(--app-income)';

  const amountText = formatMoney(amount, currency);
  return (
    <button
      type="button"
      className="flex min-w-0 flex-col items-center gap-1 rounded-xl px-0.5 py-1 select-none active:scale-95"
      style={{ transition: 'transform 120ms ease-out' }}
      aria-label={`${category.name}: ${amountText}${budget ? `, бюджет ${Math.round(budget.ratio * 100)}%` : ''}. ${editing ? 'Изменить категорию' : category.kind === 'income' ? 'Добавить доход' : 'Добавить расход'}`}
      onPointerDown={(e) => {
        longPressed.current = false;
        start.current = { x: e.clientX, y: e.clientY };
        cancel();
        timer.current = window.setTimeout(() => {
          longPressed.current = true;
          onLongPress();
        }, 500);
      }}
      onPointerMove={(e) => {
        if (
          start.current &&
          Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 8
        ) {
          cancel();
        }
      }}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        if (longPressed.current) return;
        onTap();
      }}
    >
      <span className="block w-full truncate text-center text-xs leading-tight text-muted">
        {category.name}
      </span>
      <span
        className="relative flex items-center justify-center"
        style={{ width: SIZE + 10, height: SIZE + 10 }}
      >
        {budget && (
          <svg
            className="absolute inset-0"
            viewBox={`0 0 ${SIZE + 10} ${SIZE + 10}`}
            aria-hidden="true"
          >
            <circle
              cx={(SIZE + 10) / 2}
              cy={(SIZE + 10) / 2}
              r={r}
              fill="none"
              stroke="var(--app-surface-2)"
              strokeWidth={3}
            />
            <circle
              cx={(SIZE + 10) / 2}
              cy={(SIZE + 10) / 2}
              r={r}
              fill="none"
              stroke={budgetColor}
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray={`${ratio * circumference} ${circumference}`}
              transform={`rotate(-90 ${(SIZE + 10) / 2} ${(SIZE + 10) / 2})`}
            />
          </svg>
        )}
        <span
          className={`flex items-center justify-center rounded-full text-white ${editing ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface' : ''}`}
          style={{
            width: SIZE,
            height: SIZE,
            background: category.color,
            opacity: amount > 0 || editing ? 1 : 0.55,
          }}
        >
          <Icon name={category.icon} size={24} />
        </span>
      </span>
      <span
        className={`tabular block w-full truncate text-center text-xs font-semibold ${amount > 0 ? 'text-text' : 'text-muted'}`}
      >
        {amountText}
      </span>
    </button>
  );
}

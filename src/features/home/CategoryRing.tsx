import type { CategorySlice } from '../../domain/stats';

/**
 * Кольцо расходов (или доходов) по категориям.
 * Чистый SVG без библиотек: рисуется мгновенно даже на слабых телефонах.
 */
export function CategoryRing({
  slices,
  size = 168,
  stroke = 18,
  children,
}: {
  slices: CategorySlice[];
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = size / 2;
  const total = slices.reduce((s, x) => s + x.amount, 0);
  const circumference = 2 * Math.PI * r;
  // Небольшой зазор между секторами; у одного сектора зазора нет.
  const gap = slices.length > 1 ? Math.min(4, circumference / slices.length / 4) : 0;
  let offset = 0;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke="var(--app-surface-2)"
          strokeWidth={stroke}
        />
        {total > 0 &&
          slices.map((s) => {
            const length = (s.amount / total) * circumference;
            const dash = Math.max(0, length - gap);
            const el = (
              <circle
                key={s.categoryId ?? 'none'}
                cx={c}
                cy={c}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={stroke}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                transform={`rotate(-90 ${c} ${c})`}
              />
            );
            offset += length;
            return el;
          })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
}

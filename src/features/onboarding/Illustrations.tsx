import type { CSSProperties, ReactNode } from 'react';
import { CloudOff, FileUp, Lock, ShieldCheck } from 'lucide-react';
import { Icon } from '../../ui/Icon';
import { useT } from '../../i18n';

/*
 * Анимированные сценки для знакомства с приложением. Только CSS-анимации transform/opacity
 * (классы ob-* в styles/index.css) — плавно даже на слабых телефонах.
 */

const delay = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

/** Карточка-«экран телефона», в которой разыгрывается сценка. */
function Stage({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative mx-auto flex h-60 w-full max-w-[17rem] items-center justify-center overflow-hidden rounded-[2rem] border border-border bg-surface shadow-sm"
      aria-hidden="true"
    >
      {children}
    </div>
  );
}

const RING = [
  { color: '#2f9e44', len: 30, icon: 'cart' },
  { color: '#e8590c', len: 22, icon: 'utensils' },
  { color: '#1c7ed6', len: 18, icon: 'bus' },
  { color: '#ae3ec9', len: 14, icon: 'gamepad' },
  { color: '#f59f00', len: 10, icon: 'home' },
];
const RING_STARTS = RING.map((_, i) => RING.slice(0, i).reduce((sum, s) => sum + s.len + 1.2, 0));

function MiniRing({ size = 112, animated = true }: { size?: number; animated?: boolean }) {
  const t = useT();
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="38" fill="none" stroke="var(--app-surface-2)" strokeWidth="12" />
      <g transform="rotate(-90 50 50)">
        {RING.map((s, i) => {
          const start = RING_STARTS[i];
          return (
            <circle
              key={s.color}
              cx="50"
              cy="50"
              r="38"
              fill="none"
              stroke={s.color}
              strokeWidth="12"
              pathLength={100}
              strokeDasharray={`${s.len} 100`}
              strokeDashoffset={-start}
              className={animated ? 'ob-logo-arc' : undefined}
              style={
                animated
                  ? ({ '--len': s.len, ...delay(200 + i * 160) } as CSSProperties)
                  : undefined
              }
            />
          );
        })}
      </g>
      <text x="50" y="47" textAnchor="middle" fontSize="8" fill="var(--app-muted)">
        {t('ill.expenses')}
      </text>
      <text
        x="50"
        y="59"
        textAnchor="middle"
        fontSize="11"
        fontWeight="700"
        fill="var(--app-expense)"
      >
        23 760
      </text>
    </svg>
  );
}

function Bubble({
  icon,
  color,
  ms,
  size = 34,
}: {
  icon: string;
  color: string;
  ms: number;
  size?: number;
}) {
  return (
    <span
      className="ob-pop flex items-center justify-center rounded-full text-white"
      style={{ width: size, height: size, background: color, ...delay(ms) }}
    >
      <Icon name={icon} size={Math.round(size * 0.5)} />
    </span>
  );
}

/** 1. Круг расходов и категории вокруг него. */
export function RingIllustration() {
  const around = [
    { icon: 'cart', color: '#2f9e44', x: '12%', y: '12%' },
    { icon: 'utensils', color: '#e8590c', x: '74%', y: '12%' },
    { icon: 'bus', color: '#1c7ed6', x: '6%', y: '58%' },
    { icon: 'gamepad', color: '#ae3ec9', x: '80%', y: '58%' },
    { icon: 'home', color: '#f59f00', x: '42%', y: '80%' },
  ];
  return (
    <Stage>
      <div className="ob-pop" style={delay(50)}>
        <MiniRing />
      </div>
      {around.map((b, i) => (
        <span key={b.icon} className="absolute" style={{ left: b.x, top: b.y }}>
          <Bubble icon={b.icon} color={b.color} ms={600 + i * 120} />
        </span>
      ))}
    </Stage>
  );
}

/** 2. Нажатие на категорию — и шторка с калькулятором. */
export function QuickAddIllustration() {
  const t = useT();
  return (
    <Stage>
      <div className="grid grid-cols-3 gap-4 pb-16">
        {RING.slice(0, 6).map((b) => (
          <span key={b.icon} className="relative flex flex-col items-center gap-1">
            <Bubble icon={b.icon} color={b.color} ms={0} size={38} />
            {b.icon === 'utensils' && (
              <>
                <span
                  className="ob-pulse-ring absolute top-0 h-[38px] w-[38px] rounded-full border-2"
                  style={{ borderColor: b.color }}
                />
                <span className="ob-tap absolute top-5 left-6 h-7 w-7 rounded-full border-2 border-white bg-text/30" />
              </>
            )}
            <span className="h-1.5 w-8 rounded-full bg-surface-2" />
          </span>
        ))}
      </div>
      <div className="ob-sheet absolute inset-x-2 bottom-0 rounded-t-2xl border border-border bg-surface p-2 shadow-lg">
        <div className="mb-2 flex items-center gap-1.5">
          <span className="flex h-7 flex-1 items-center justify-center rounded-lg bg-[#1c7ed6] text-[0.625rem] font-semibold text-white">
            {t('ill.card')}
          </span>
          <span className="text-xs text-muted">→</span>
          <span className="flex h-7 flex-1 items-center justify-center rounded-lg bg-[#e8590c] text-[0.625rem] font-semibold text-white">
            {t('ill.cafe')}
          </span>
        </div>
        <div className="tabular mb-2 text-right text-lg font-bold text-expense">1 250</div>
        <div className="grid grid-cols-4 gap-1">
          {['7', '8', '9', '+', '4', '5', '6', '−'].map((k) => (
            <span
              key={k}
              className="flex h-5 items-center justify-center rounded-md bg-surface-2 text-[0.625rem]"
            >
              {k}
            </span>
          ))}
        </div>
      </div>
    </Stage>
  );
}

/** 3. Счета, переводы и бюджеты. */
export function AccountsIllustration() {
  const t = useT();
  const accounts = [
    { name: t('ill.card'), icon: 'credit-card', color: '#4f46e5', sum: '5 534' },
    { name: t('ill.savings'), icon: 'piggy-bank', color: '#0ca678', sum: '120 000' },
  ];
  const budgets = [
    { name: t('ill.groceries'), color: '#2f9e44', ratio: 0.62 },
    { name: t('ill.cafe'), color: '#e8590c', ratio: 0.88 },
  ];
  return (
    <Stage>
      <div className="flex w-full flex-col gap-2 px-4">
        {accounts.map((a, i) => (
          <div
            key={a.name}
            className="ob-fade-up flex items-center gap-2 rounded-xl bg-surface-2 px-2 py-1.5"
            style={delay(100 + i * 150)}
          >
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full text-white"
              style={{ background: a.color }}
            >
              <Icon name={a.icon} size={14} />
            </span>
            <span className="flex-1 text-xs font-medium">{a.name}</span>
            <span className="tabular text-xs font-semibold">{a.sum}</span>
          </div>
        ))}
        <div className="ob-fade-up mt-1 flex flex-col gap-2" style={delay(450)}>
          {budgets.map((b, i) => (
            <div key={b.name}>
              <div className="mb-0.5 flex justify-between text-[0.625rem] text-muted">
                <span>{b.name}</span>
                <span>{Math.round(b.ratio * 100)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="ob-grow-x h-full rounded-full"
                  style={{
                    width: `${b.ratio * 100}%`,
                    background: b.ratio > 0.8 ? 'var(--app-warning)' : 'var(--app-income)',
                    ...delay(650 + i * 200),
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Stage>
  );
}

/** 4. Статистика: столбцы по дням и кольцо по категориям. */
export function StatsIllustration() {
  const bars = [0.35, 0.6, 0.45, 0.9, 0.55, 0.75, 0.4];
  return (
    <Stage>
      <div className="flex w-full flex-col items-center gap-3 px-5">
        <div className="ob-pop" style={delay(50)}>
          <MiniRing size={86} />
        </div>
        <div className="flex h-20 w-full items-end justify-between gap-1.5">
          {bars.map((h, i) => (
            <span
              key={i}
              className="ob-grow-y flex-1 rounded-t-md"
              style={{
                height: `${h * 100}%`,
                background: i === 3 ? 'var(--chart-expense)' : 'var(--chart-income)',
                opacity: i === 3 ? 1 : 0.75,
                ...delay(500 + i * 90),
              }}
            />
          ))}
        </div>
      </div>
    </Stage>
  );
}

/** 5. Данные только на устройстве, офлайн, импорт данных. */
export function PrivacyIllustration() {
  const t = useT();
  const badges = [
    { icon: <CloudOff size={18} />, label: t('ill.offline'), x: '6%', y: '14%' },
    { icon: <Lock size={18} />, label: t('ill.pin'), x: '66%', y: '10%' },
    { icon: <FileUp size={18} />, label: t('ill.import'), x: '62%', y: '72%' },
  ];
  return (
    <Stage>
      <div className="ob-pop relative flex h-24 w-24 items-center justify-center" style={delay(50)}>
        <span className="ob-pulse-ring absolute inset-0 rounded-full bg-accent-soft" />
        <span className="ob-float flex h-20 w-20 items-center justify-center rounded-full bg-accent text-accent-fg">
          <ShieldCheck size={40} />
        </span>
      </div>
      {badges.map((b, i) => (
        <span
          key={b.label}
          className="ob-pop absolute flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-medium shadow-sm"
          style={{ left: b.x, top: b.y, ...delay(500 + i * 180) }}
        >
          <span className="text-accent">{b.icon}</span>
          {b.label}
        </span>
      ))}
    </Stage>
  );
}

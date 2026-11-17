import { useT } from '../i18n';

/**
 * Логотип «Акчакана»: кольцо из сегментов (как круг расходов на главном экране) и монета в центре.
 * С `animated` сегменты прорисовываются по очереди, кольцо доворачивается, монета «выпрыгивает».
 * Статичная копия для иконок приложения — `public/logo.svg`.
 */
const SEGMENTS = [
  { color: '#ffffff', len: 34 },
  { color: '#c7d2fe', len: 24 },
  { color: '#a5b4fc', len: 18 },
  { color: '#fbbf24', len: 12 },
];
const GAP = 3;
/** Начало каждого сегмента на окружности (в долях pathLength = 100). */
const STARTS = SEGMENTS.map((_, i) =>
  SEGMENTS.slice(0, i).reduce((sum, s) => sum + s.len + GAP, 0),
);

export function AppLogo({ size = 96, animated = false }: { size?: number; animated?: boolean }) {
  const t = useT();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label={t('logo.label')}
      className={animated ? 'ob-logo-float' : undefined}
    >
      <rect width="120" height="120" rx="30" fill="#4f46e5" />
      <g transform="rotate(-90 60 60)">
        <g
          className={animated ? 'ob-logo-spin' : undefined}
          style={{ transformOrigin: '60px 60px' }}
        >
          {SEGMENTS.map((s, i) => {
            const start = STARTS[i];
            return (
              <circle
                key={s.color}
                cx="60"
                cy="60"
                r="31"
                fill="none"
                stroke={s.color}
                strokeWidth="13"
                pathLength={100}
                strokeDasharray={`${s.len} 100`}
                strokeDashoffset={-start}
                className={animated ? 'ob-logo-arc' : undefined}
                style={
                  animated
                    ? ({
                        '--len': s.len,
                        animationDelay: `${150 + i * 180}ms`,
                      } as React.CSSProperties)
                    : undefined
                }
              />
            );
          })}
        </g>
      </g>
      <g className={animated ? 'ob-logo-coin' : undefined} style={{ transformOrigin: '60px 60px' }}>
        <circle cx="60" cy="60" r="13" fill="#fbbf24" />
        <circle cx="60" cy="60" r="9" fill="none" stroke="#f59e0b" strokeWidth="2.5" />
        <path
          d="M54.5 57.5a6 6 0 0 1 5-4.5"
          fill="none"
          stroke="#fffbeb"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

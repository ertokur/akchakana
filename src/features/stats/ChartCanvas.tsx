import { useEffect, useRef, useSyncExternalStore } from 'react';
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  LinearScale,
  Tooltip,
  type ChartConfiguration,
} from 'chart.js';

// Регистрируем только нужное — остальное Chart.js выкидывается при сборке.
Chart.register(
  DoughnutController,
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
);

function subscribeTheme(cb: () => void) {
  const observer = new MutationObserver(cb);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
}

/** true в тёмной теме; графики перерисовываются при смене темы. */
export function useIsDark(): boolean {
  return useSyncExternalStore(subscribeTheme, () =>
    document.documentElement.classList.contains('dark'),
  );
}

export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Тонкая обёртка над Chart.js: создаёт график на canvas и пересоздаёт его при смене конфигурации. */
export function ChartCanvas({
  config,
  label,
  height = 220,
}: {
  config: ChartConfiguration<'doughnut'> | ChartConfiguration<'bar'>;
  label: string;
  height?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !canvas.getContext('2d')) return;
    const chart = new Chart(canvas, config as ChartConfiguration);
    return () => chart.destroy();
  }, [config]);
  return (
    <div style={{ height }} className="relative">
      <canvas ref={ref} role="img" aria-label={label} />
    </div>
  );
}

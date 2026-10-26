import { useMemo, useState } from 'react';
import type { ChartConfiguration } from 'chart.js';
import { ChevronLeft, TrendingDown, TrendingUp } from 'lucide-react';
import { summarize } from '../../domain/balances';
import { formatInTz, previousPeriod, startOfDayKey } from '../../domain/dates';
import { formatMinor, formatMoney, fractionDigits } from '../../domain/money';
import {
  bucketFor,
  changePercent,
  foldSmallSlices,
  seriesByBucket,
  totalsByCategory,
  type BucketPoint,
  type CategorySlice,
} from '../../domain/stats';
import type { CategoryKind, Id } from '../../domain/types';
import { byOrder, useData } from '../../stores/dataStore';
import { useUi } from '../../stores/uiStore';
import { Card, EmptyState, SegmentedControl, Select } from '../../ui/controls';
import { IconBadge } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { usePeriod, usePeriodOptions } from '../shared/hooks';
import { filterTransactions } from '../transactions/grouping';
import { PeriodSwitcher } from '../transactions/PeriodSwitcher';
import { ChartCanvas, cssVar, useIsDark } from './ChartCanvas';

export function StatsScreen() {
  const transactions = useData((s) => s.transactions);
  const accounts = useData((s) => s.accounts);
  const categories = useData((s) => s.categories);
  const settings = useData((s) => s.settings);
  const accountFilter = useUi((s) => s.accountFilter);
  const setAccountFilter = useUi((s) => s.setAccountFilter);
  const period = usePeriod();
  const opts = usePeriodOptions();
  const isDark = useIsDark();
  const [kind, setKind] = useState<CategoryKind>('expense');
  const [drill, setDrill] = useState<Id | null>(null);

  const currency =
    accountFilter === 'all'
      ? settings.defaultCurrency
      : (accounts.find((a) => a.id === accountFilter)?.currency ?? settings.defaultCurrency);

  const current = useMemo(
    () => filterTransactions(transactions, period.start, period.end, accountFilter),
    [transactions, period, accountFilter],
  );
  const prevPeriod = useMemo(() => previousPeriod(period, opts), [period, opts]);
  const previous = useMemo(
    () => filterTransactions(transactions, prevPeriod.start, prevPeriod.end, accountFilter),
    [transactions, prevPeriod, accountFilter],
  );
  const sumNow = summarize(current, currency);
  const sumPrev = summarize(previous, currency);

  const slices = useMemo(
    () => totalsByCategory(current, categories, kind, currency, drill ? { parentId: drill } : {}),
    [current, categories, kind, currency, drill],
  );
  const total = slices.reduce((s, x) => s + x.amount, 0);
  const series = useMemo(
    () => seriesByBucket(current, period, settings.timeZone, currency),
    [current, period, settings.timeZone, currency],
  );
  const bucket = bucketFor(period, settings.timeZone);
  const drillCategory = drill ? categories.find((c) => c.id === drill) : undefined;
  const hasChildren = (id: Id | null) => !!id && categories.some((c) => c.parentId === id);

  return (
    <Screen
      title="Обзор"
      actions={
        accounts.length > 1 ? (
          <Select
            aria-label="Фильтр по счёту"
            className="max-w-[45%] min-w-0 text-sm"
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
          >
            <option value="all">Все счета</option>
            {[...accounts].sort(byOrder).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        ) : null
      }
      header={<PeriodSwitcher />}
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2">
          <CompareCard
            label="Расходы"
            value={sumNow.expense}
            prev={sumPrev.expense}
            currency={currency}
            higherIsBad
          />
          <CompareCard
            label="Доходы"
            value={sumNow.income}
            prev={sumPrev.income}
            currency={currency}
          />
        </div>

        <Card>
          <SegmentedControl
            label="Тип операций на диаграмме"
            size="sm"
            value={kind}
            options={[
              { value: 'expense', label: 'Расходы' },
              { value: 'income', label: 'Доходы' },
            ]}
            onChange={(v) => {
              setKind(v);
              setDrill(null);
            }}
          />
          {drillCategory && (
            <button
              type="button"
              onClick={() => setDrill(null)}
              className="mt-2 flex min-h-11 items-center gap-1 font-medium text-accent"
            >
              <ChevronLeft size={18} /> Все категории · {drillCategory.name}
            </button>
          )}
          {slices.length === 0 ? (
            <EmptyState title="Нет данных за период" />
          ) : (
            <>
              <DonutChart slices={slices} total={total} currency={currency} isDark={isDark} />
              <ul className="mt-3 flex flex-col" aria-label="Категории">
                {slices.map((s) => {
                  const canDrill = !drill && hasChildren(s.categoryId);
                  const content = (
                    <>
                      <IconBadge name={s.icon} color={s.color} size={32} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{s.name}</span>
                        <span className="tabular block text-xs text-muted">
                          {total
                            ? `${((s.amount / total) * 100).toFixed(1).replace('.', ',')}%`
                            : ''}
                        </span>
                      </span>
                      <span className="tabular text-right font-medium whitespace-nowrap">
                        {formatMoney(s.amount, currency)}
                      </span>
                    </>
                  );
                  return (
                    <li key={s.categoryId ?? 'none'}>
                      {canDrill ? (
                        <button
                          type="button"
                          onClick={() => setDrill(s.categoryId)}
                          className="flex min-h-12 w-full items-center gap-3 text-left"
                          aria-label={`${s.name}: подкатегории`}
                        >
                          {content}
                        </button>
                      ) : (
                        <div className="flex min-h-12 items-center gap-3">{content}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Card>

        <Card>
          <h2 className="mb-2 font-semibold">
            {bucket === 'day' ? 'По дням' : 'По месяцам'}, {currency}
          </h2>
          <BarsChart
            series={series}
            bucket={bucket}
            currency={currency}
            isDark={isDark}
            timeZone={settings.timeZone}
          />
          <details className="mt-2">
            <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-accent">
              Показать таблицей
            </summary>
            <SeriesTable
              series={series}
              bucket={bucket}
              currency={currency}
              timeZone={settings.timeZone}
            />
          </details>
        </Card>
      </div>
    </Screen>
  );
}

function CompareCard({
  label,
  value,
  prev,
  currency,
  higherIsBad = false,
}: {
  label: string;
  value: number;
  prev: number;
  currency: string;
  higherIsBad?: boolean;
}) {
  const pct = changePercent(value, prev);
  const up = pct !== null && pct > 0;
  const bad = pct !== null && pct !== 0 && up === higherIsBad;
  const Arrow = up ? TrendingUp : TrendingDown;
  return (
    <Card className="p-3">
      <div className="text-sm text-muted">{label}</div>
      <div className="tabular text-base font-bold break-words">{formatMoney(value, currency)}</div>
      <div
        className={`flex items-center gap-1 text-xs ${pct === null || pct === 0 ? 'text-muted' : bad ? 'text-expense' : 'text-income'}`}
      >
        {pct !== null && pct !== 0 && <Arrow size={14} aria-hidden="true" />}
        {pct === null
          ? 'нет данных за прошлый период'
          : `${pct > 0 ? '+' : ''}${String(pct).replace('.', ',')}% к прошлому периоду`}
      </div>
    </Card>
  );
}

function DonutChart({
  slices,
  total,
  currency,
  isDark,
}: {
  slices: CategorySlice[];
  total: number;
  currency: string;
  isDark: boolean;
}) {
  const config = useMemo((): ChartConfiguration<'doughnut'> => {
    const folded = foldSmallSlices(slices);
    const surface = cssVar('--app-surface') || (isDark ? '#151c1a' : '#ffffff');
    return {
      type: 'doughnut',
      data: {
        labels: folded.map((s) => s.name),
        datasets: [
          {
            data: folded.map((s) => s.amount),
            backgroundColor: folded.map((s) => s.color),
            borderColor: surface,
            borderWidth: 2,
            hoverOffset: 6,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        locale: 'ru-RU',
        cutout: '68%',
        animation: false,
        plugins: {
          tooltip: {
            callbacks: {
              label: (ctx) =>
                ` ${formatMoney(ctx.parsed as number, currency)} (${Math.round(((ctx.parsed as number) / total) * 100)}%)`,
            },
          },
        },
      },
    };
  }, [slices, total, currency, isDark]);

  return (
    <div className="relative mt-3">
      <ChartCanvas
        config={config}
        label={`Диаграмма по категориям, всего ${formatMoney(total, currency)}`}
      />
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs text-muted">Всего</span>
        <span className="tabular text-lg font-bold">{formatMoney(total, currency)}</span>
      </div>
    </div>
  );
}

function bucketLabel(key: string, bucket: 'day' | 'month', timeZone: string, pattern?: string) {
  const ts = startOfDayKey(bucket === 'day' ? key : `${key}-01`, timeZone) + 12 * 3600_000;
  return formatInTz(ts, timeZone, pattern ?? (bucket === 'day' ? 'd' : 'LLL'));
}

function BarsChart({
  series,
  bucket,
  currency,
  isDark,
  timeZone,
}: {
  series: BucketPoint[];
  bucket: 'day' | 'month';
  currency: string;
  isDark: boolean;
  timeZone: string;
}) {
  const config = useMemo((): ChartConfiguration<'bar'> => {
    const digits = fractionDigits(currency);
    const grid = cssVar('--app-border') || (isDark ? '#2e3a37' : '#d3dbd8');
    const muted = cssVar('--app-muted') || (isDark ? '#a2b1ac' : '#48534f');
    const toUnits = (v: number) => v / 10 ** digits; // только для масштаба графика, не для хранения
    return {
      type: 'bar',
      data: {
        labels: series.map((p) => bucketLabel(p.key, bucket, timeZone)),
        datasets: [
          {
            label: 'Доходы',
            data: series.map((p) => toUnits(p.income)),
            backgroundColor: cssVar('--chart-income'),
            borderRadius: 4,
            borderSkipped: 'start',
            maxBarThickness: 18,
          },
          {
            label: 'Расходы',
            data: series.map((p) => toUnits(p.expense)),
            backgroundColor: cssVar('--chart-expense'),
            borderRadius: 4,
            borderSkipped: 'start',
            maxBarThickness: 18,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        locale: 'ru-RU',
        animation: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: muted, maxRotation: 0, autoSkipPadding: 8 },
          },
          y: {
            beginAtZero: true,
            grid: { color: grid },
            border: { display: false },
            ticks: { color: muted, maxTicksLimit: 5 },
          },
        },
        plugins: {
          tooltip: {
            callbacks: {
              title: (items) =>
                bucketLabel(
                  series[items[0].dataIndex].key,
                  bucket,
                  timeZone,
                  bucket === 'day' ? 'd MMMM' : 'LLLL yyyy',
                ),
              label: (ctx) => {
                const p = series[ctx.dataIndex];
                const v = ctx.datasetIndex === 0 ? p.income : p.expense;
                return ` ${ctx.dataset.label}: ${formatMoney(v, currency)}`;
              },
            },
          },
        },
      },
    };
  }, [series, bucket, currency, isDark, timeZone]);

  return (
    <>
      <div className="mb-2 flex gap-4 text-sm" aria-hidden="true">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm" style={{ background: 'var(--chart-income)' }} />{' '}
          Доходы
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm" style={{ background: 'var(--chart-expense)' }} />{' '}
          Расходы
        </span>
      </div>
      <ChartCanvas config={config} label="Столбчатая диаграмма доходов и расходов" />
    </>
  );
}

function SeriesTable({
  series,
  bucket,
  currency,
  timeZone,
}: {
  series: BucketPoint[];
  bucket: 'day' | 'month';
  currency: string;
  timeZone: string;
}) {
  const digits = fractionDigits(currency);
  const rows = series.filter((p) => p.income || p.expense);
  if (rows.length === 0) return <p className="text-sm text-muted">Нет операций.</p>;
  return (
    <table className="tabular w-full text-sm">
      <thead>
        <tr className="text-left text-muted">
          <th className="py-1 font-medium">{bucket === 'day' ? 'День' : 'Месяц'}</th>
          <th className="py-1 text-right font-medium">Доходы</th>
          <th className="py-1 text-right font-medium">Расходы</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((p) => (
          <tr key={p.key} className="border-t border-border">
            <td className="py-1.5">
              {bucketLabel(p.key, bucket, timeZone, bucket === 'day' ? 'd MMM' : 'LLLL yyyy')}
            </td>
            <td className="py-1.5 text-right">
              {formatMinor(p.income, digits, { trimZeros: true })}
            </td>
            <td className="py-1.5 text-right">
              {formatMinor(p.expense, digits, { trimZeros: true })}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

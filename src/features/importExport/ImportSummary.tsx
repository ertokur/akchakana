import { AlertTriangle, CircleX } from 'lucide-react';
import { computeBalances } from '../../domain/balances';
import { formatDate } from '../../domain/dates';
import { formatMoney } from '../../domain/money';
import { summarizePlan, type ImportPlan } from '../../importers/types';
import { Card } from '../../ui/controls';
import { useT } from '../../i18n';

/** Сводка перед импортом: что и сколько будет записано, ошибки и предупреждения. */
export function ImportSummary({ plan, timeZone }: { plan: ImportPlan; timeZone: string }) {
  const t = useT();
  const s = summarizePlan(plan);
  const rows: [string, string | number][] = [
    [t('summary.transactions'), s.transactions],
    ['  ' + t('summary.expenses'), s.expenses],
    ['  ' + t('summary.incomes'), s.incomes],
    ['  ' + t('summary.transfers'), s.transfers],
    ['  ' + t('summary.refunds'), s.refunds],
    [t('summary.accounts'), s.accounts],
    [
      t('summary.categories'),
      s.hiddenCategories
        ? t('summary.categoriesHidden', { count: s.categories, hidden: s.hiddenCategories })
        : s.categories,
    ],
  ];
  if (s.budgets) rows.push([t('summary.budgets'), s.budgets]);
  if (s.debts) rows.push([t('summary.debts'), s.debts]);
  if (s.recurring) rows.push([t('summary.recurring'), s.recurring]);
  if (s.duplicates) rows.push([t('summary.duplicates'), s.duplicates]);
  rows.push([
    t('period.title'),
    s.from !== undefined && s.to !== undefined
      ? `${formatDate(s.from, timeZone, 'dayShortYear')} — ${formatDate(s.to, timeZone, 'dayShortYear')}`
      : '—',
  ]);
  rows.push([t('common.currency'), s.currencies.join(', ') || '—']);

  const balances = computeBalances(plan.accounts, plan.transactions);

  return (
    <div className="flex flex-col gap-3">
      {plan.accounts.length > 0 && (
        <Card>
          <h2 className="mb-2 font-semibold">{t('summary.balancesAfter')}</h2>
          <ul className="tabular flex flex-col gap-1" aria-label={t('summary.balances')}>
            {plan.accounts.map((a) => (
              <li key={a.id} className="flex justify-between gap-3">
                <span className={a.archived ? 'text-muted' : ''}>{a.name}</span>
                <span className="font-semibold">
                  {formatMoney(balances.get(a.id) ?? 0, a.currency)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-muted">{t('summary.checkBalances')}</p>
        </Card>
      )}
      <Card>
        <h2 className="mb-2 font-semibold">{t('summary.willImport')}</h2>
        <dl className="tabular grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className={label.startsWith('  ') ? 'pl-4 text-sm text-muted' : 'text-muted'}>
                {label.trim()}
              </dt>
              <dd className={`text-right ${label.startsWith('  ') ? 'text-sm' : 'font-semibold'}`}>
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </Card>
      {plan.errors.length > 0 && (
        <Card>
          <h2 className="mb-2 flex items-center gap-2 font-semibold text-expense">
            <CircleX size={18} aria-hidden="true" />{' '}
            {t('summary.errors', { count: plan.errors.length })}
          </h2>
          <ul className="max-h-56 overflow-y-auto text-sm">
            {plan.errors.slice(0, 200).map((e, i) => (
              <li key={i} className="border-t border-border py-1.5 first:border-t-0">
                {e.row ? (
                  <span className="font-semibold">{t('summary.row', { row: e.row })} </span>
                ) : null}
                {e.message}
              </li>
            ))}
          </ul>
        </Card>
      )}
      {plan.warnings.length > 0 && (
        <details className="rounded-2xl bg-surface p-4">
          <summary className="flex min-h-11 cursor-pointer items-center gap-2 font-semibold text-warning">
            <AlertTriangle size={18} aria-hidden="true" />{' '}
            {t('summary.warnings', { count: plan.warnings.length })}
          </summary>
          <ul className="mt-2 max-h-56 overflow-y-auto text-sm">
            {plan.warnings.map((w, i) => (
              <li key={i} className="border-t border-border py-1.5 first:border-t-0">
                {w}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

import { AlertTriangle, CircleX } from 'lucide-react';
import { formatInTz } from '../../domain/dates';
import { summarizePlan, type ImportPlan } from '../../importers/types';
import { Card } from '../../ui/controls';

/** Сводка перед импортом: что и сколько будет записано, ошибки и предупреждения. */
export function ImportSummary({ plan, timeZone }: { plan: ImportPlan; timeZone: string }) {
  const s = summarizePlan(plan);
  const rows: [string, string | number][] = [
    ['Операций', s.transactions],
    ['  расходов', s.expenses],
    ['  доходов', s.incomes],
    ['  переводов', s.transfers],
    ['  из них возвратов', s.refunds],
    ['Счетов', s.accounts],
    [
      'Категорий',
      s.hiddenCategories ? `${s.categories} (скрытых ${s.hiddenCategories})` : s.categories,
    ],
  ];
  if (s.budgets) rows.push(['Бюджетов', s.budgets]);
  if (s.debts) rows.push(['Долгов', s.debts]);
  if (s.recurring) rows.push(['Регулярных платежей', s.recurring]);
  if (s.duplicates) rows.push(['Дубликатов (будут пропущены)', s.duplicates]);
  rows.push([
    'Период',
    s.from !== undefined && s.to !== undefined
      ? `${formatInTz(s.from, timeZone, 'd MMM yyyy')} — ${formatInTz(s.to, timeZone, 'd MMM yyyy')}`
      : '—',
  ]);
  rows.push(['Валюта', s.currencies.join(', ') || '—']);

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <h2 className="mb-2 font-semibold">Будет импортировано</h2>
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
            <CircleX size={18} aria-hidden="true" /> Ошибки ({plan.errors.length}) — эти строки не
            будут импортированы
          </h2>
          <ul className="max-h-56 overflow-y-auto text-sm">
            {plan.errors.slice(0, 200).map((e, i) => (
              <li key={i} className="border-t border-border py-1.5 first:border-t-0">
                {e.row ? <span className="font-semibold">Строка {e.row}: </span> : null}
                {e.message}
              </li>
            ))}
          </ul>
        </Card>
      )}
      {plan.warnings.length > 0 && (
        <details className="rounded-2xl bg-surface p-4">
          <summary className="flex min-h-11 cursor-pointer items-center gap-2 font-semibold text-warning">
            <AlertTriangle size={18} aria-hidden="true" /> Предупреждения ({plan.warnings.length})
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

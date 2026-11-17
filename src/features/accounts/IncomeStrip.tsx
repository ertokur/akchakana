import { useMemo } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { periodLabel } from '../../domain/dates';
import { totalsByCategory } from '../../domain/stats';
import { byOrder, useData } from '../../stores/dataStore';
import { useUi } from '../../stores/uiStore';
import { CategoryBubble } from '../home/CategoryBubble';
import { usePeriod, usePeriodOptions } from '../shared/hooks';
import { filterTransactions } from '../transactions/grouping';

/**
 * Верх экрана «Счета» как в 1Money: категории доходов за период.
 * Нажатие на доход открывает ввод суммы с этой категорией, кнопка «Перевод» — перевод между счетами.
 */
export function IncomeStrip() {
  const categories = useData((s) => s.categories);
  const transactions = useData((s) => s.transactions);
  const currency = useData((s) => s.settings.defaultCurrency);
  const openNew = useUi((s) => s.openNew);
  const period = usePeriod();
  const opts = usePeriodOptions();
  const income = useMemo(
    () => categories.filter((c) => c.kind === 'income' && !c.parentId && !c.archived).sort(byOrder),
    [categories],
  );
  const amounts = useMemo(() => {
    const visible = filterTransactions(transactions, period.start, period.end, 'all');
    return new Map(
      totalsByCategory(visible, categories, 'income', currency).map((s) => [
        s.categoryId,
        s.amount,
      ]),
    );
  }, [transactions, period, categories, currency]);

  return (
    <section aria-label="Доходы" className="mb-4 rounded-2xl bg-surface p-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">
          Доходы{' '}
          <span className="font-normal text-muted">· {periodLabel(period, opts.timeZone)}</span>
        </h2>
        <button
          type="button"
          onClick={() => openNew('transfer')}
          className="flex min-h-11 items-center gap-1.5 rounded-xl bg-accent-soft px-3 text-sm font-semibold text-accent-strong"
        >
          <ArrowLeftRight size={16} aria-hidden="true" /> Перевод
        </button>
      </div>
      {income.length === 0 ? (
        <p className="text-sm text-muted">Нет категорий доходов.</p>
      ) : (
        <div className="-mx-1 flex gap-1 overflow-x-auto pb-1">
          {income.map((c) => (
            <div key={c.id} className="w-[4.75rem] shrink-0">
              <CategoryBubble
                category={c}
                amount={amounts.get(c.id) ?? 0}
                currency={currency}
                editing={false}
                onTap={() => openNew('income', { categoryId: c.id })}
                onLongPress={() => openNew('income', { categoryId: c.id })}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

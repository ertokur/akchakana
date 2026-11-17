import { useMemo, useState } from 'react';
import { Check, Pencil, Plus } from 'lucide-react';
import { summarize } from '../../domain/balances';
import { budgetStatus, isBudgetActive, type BudgetStatus } from '../../domain/budgets';
import { monthKey } from '../../domain/dates';
import { formatMoney } from '../../domain/money';
import { totalsByCategory } from '../../domain/stats';
import type { Category, CategoryKind, Id } from '../../domain/types';
import { byOrder, useData } from '../../stores/dataStore';
import { useUi } from '../../stores/uiStore';
import { EmptyState, IconButton } from '../../ui/controls';
import { Screen } from '../../ui/Screen';
import { CategoryForm } from '../categories/CategoryForm';
import { ExportReminder } from '../importExport/ExportReminder';
import { RecurringDue } from '../recurring/RecurringDue';
import { AccountSelector } from '../shared/AccountSelector';
import { usePeriod } from '../shared/hooks';
import { filterTransactions } from '../transactions/grouping';
import { PeriodSwitcher } from '../transactions/PeriodSwitcher';
import { CategoryBubble } from './CategoryBubble';
import { CategoryRing } from './CategoryRing';
import { useT } from '../../i18n';

/**
 * Главный экран: кольцо расходов за период в центре, вокруг — категории.
 * Нажатие на категорию сразу открывает ввод суммы, долгое нажатие — редактирование.
 */
export function HomeScreen() {
  const t = useT();
  const transactions = useData((s) => s.transactions);
  const categories = useData((s) => s.categories);
  const accounts = useData((s) => s.accounts);
  const budgets = useData((s) => s.budgets);
  const settings = useData((s) => s.settings);
  const accountFilter = useUi((s) => s.accountFilter);
  const openNew = useUi((s) => s.openNew);
  const period = usePeriod();
  const [kind, setKind] = useState<CategoryKind>('expense');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Category | 'new' | null>(null);

  const currency =
    accountFilter === 'all'
      ? settings.defaultCurrency
      : (accounts.find((a) => a.id === accountFilter)?.currency ?? settings.defaultCurrency);
  const visible = useMemo(
    () => filterTransactions(transactions, period.start, period.end, accountFilter),
    [transactions, period, accountFilter],
  );
  const summary = summarize(visible, currency);
  const slices = useMemo(
    () => totalsByCategory(visible, categories, kind, currency),
    [visible, categories, kind, currency],
  );
  const amountById = useMemo(
    () => new Map(slices.map((s) => [s.categoryId, s.amount] as [Id | null, number])),
    [slices],
  );
  // Скрытая категория остаётся на экране, пока у неё есть операции за период:
  // иначе сумма в кольце не сходится с суммой по кружкам.
  const topLevel = useMemo(
    () =>
      categories
        .filter((c) => c.kind === kind && !c.parentId && (!c.archived || amountById.has(c.id)))
        .sort(byOrder),
    [categories, kind, amountById],
  );
  const activeCount = topLevel.filter((c) => !c.archived).length;

  const month = monthKey(period.start, settings.timeZone);
  const budgetByCategory = useMemo(() => {
    const map = new Map<Id, BudgetStatus>();
    // Бюджеты помесячные: для «всего времени» не показываем.
    if (kind !== 'expense' || period.kind === 'all') return map;
    for (const b of budgets) {
      if (!b.categoryId || b.currency !== currency || !isBudgetActive(b, month)) continue;
      map.set(b.categoryId, budgetStatus(b, month, transactions, categories, settings.timeZone));
    }
    return map;
  }, [budgets, kind, period.kind, currency, month, transactions, categories, settings.timeZone]);

  const mainTotal = kind === 'expense' ? summary.expense : summary.income;
  const otherTotal = kind === 'expense' ? summary.income : summary.expense;

  return (
    <Screen
      title={t('nav.categories')}
      actions={
        <IconButton
          label={editing ? t('common.done') : t('home.editCategories')}
          onClick={() => setEditing(!editing)}
          className={editing ? 'bg-accent text-accent-fg hover:bg-accent-strong' : ''}
        >
          {editing ? <Check size={20} /> : <Pencil size={20} />}
        </IconButton>
      }
      header={
        <div className="flex flex-col">
          <AccountSelector />
          <PeriodSwitcher />
        </div>
      }
    >
      <ExportReminder />
      <RecurringDue />
      {accounts.length === 0 ? (
        <EmptyState title={t('home.noAccounts')} text={t('home.noAccountsText')} />
      ) : (
        <>
          {editing && <p className="mb-2 text-center text-sm text-muted">{t('home.editHint')}</p>}
          <div
            className="grid grid-cols-4 gap-x-1 gap-y-2"
            style={{ gridAutoFlow: 'row dense' }}
            aria-label={
              kind === 'expense' ? t('home.expenseCategories') : t('home.incomeCategories')
            }
            role="group"
          >
            <div className="col-span-2 col-start-2 row-span-2 row-start-2 flex items-center justify-center">
              <button
                type="button"
                className="rounded-full"
                onClick={() => setKind(kind === 'expense' ? 'income' : 'expense')}
                aria-label={t(kind === 'expense' ? 'home.ringExpenseAria' : 'home.ringIncomeAria', {
                  amount: formatMoney(mainTotal, currency),
                })}
              >
                <CategoryRing slices={slices} size={152}>
                  <span className="text-xs text-muted">
                    {kind === 'expense' ? t('common.expenses') : t('common.incomes')}
                  </span>
                  <span
                    className={`tabular max-w-[8.5rem] text-base leading-tight font-bold break-words ${kind === 'expense' ? 'text-expense' : 'text-income'}`}
                  >
                    {formatMoney(mainTotal, currency)}
                  </span>
                  <span
                    className={`tabular mt-1 max-w-[8.5rem] text-xs break-words ${kind === 'expense' ? 'text-income' : 'text-expense'}`}
                  >
                    {formatMoney(otherTotal, currency)}
                  </span>
                </CategoryRing>
              </button>
            </div>
            {/* Одна категория и «Добавить» — ставим их по центру над кругом, а не в левый угол. */}
            {topLevel.length <= 1 && <div aria-hidden="true" />}
            {topLevel.map((c) => (
              <CategoryBubble
                key={c.id}
                category={c}
                amount={amountById.get(c.id) ?? 0}
                currency={currency}
                budget={budgetByCategory.get(c.id)}
                editing={editing}
                onTap={() => (editing ? setForm(c) : openNew(kind, { categoryId: c.id }))}
                onLongPress={() => setForm(c)}
              />
            ))}
            <button
              type="button"
              onClick={() => setForm('new')}
              className="flex flex-col items-center gap-1 rounded-xl py-1"
              aria-label={
                kind === 'expense' ? t('home.newExpenseCategory') : t('home.newIncomeCategory')
              }
            >
              <span className="text-xs text-muted">{t('common.add')}</span>
              <span className="flex h-[62px] w-[62px] items-center justify-center">
                <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full border-2 border-dashed border-border text-muted">
                  <Plus size={24} />
                </span>
              </span>
            </button>
          </div>
          {!editing && <p className="mt-4 text-center text-xs text-muted">{t('home.ringHint')}</p>}
        </>
      )}
      {form && (
        <CategoryForm
          category={form === 'new' ? undefined : form}
          kind={kind}
          siblingsCount={activeCount}
          onClose={() => setForm(null)}
        />
      )}
    </Screen>
  );
}

import { useCallback, useMemo } from 'react';
import { Plus, ReceiptText } from 'lucide-react';
import { summarize } from '../../domain/balances';
import { dayHeading } from '../../domain/dates';
import { formatMoney } from '../../domain/money';
import type { Transaction } from '../../domain/types';
import { byOrder, useData } from '../../stores/dataStore';
import { useUi } from '../../stores/uiStore';
import { Button, EmptyState, Select } from '../../ui/controls';
import { Screen } from '../../ui/Screen';
import { useLookups, useNow, usePeriod } from '../shared/hooks';
import { filterTransactions, groupByDay } from './grouping';
import { PeriodSwitcher } from './PeriodSwitcher';
import { TransactionRow } from './TransactionRow';
import { ExportReminder } from '../importExport/ExportReminder';
import { RecurringDue } from '../recurring/RecurringDue';

export function TransactionsScreen() {
  const transactions = useData((s) => s.transactions);
  const accounts = useData((s) => s.accounts);
  const settings = useData((s) => s.settings);
  const saveTransaction = useData((s) => s.saveTransaction);
  const deleteTransaction = useData((s) => s.deleteTransaction);
  const { accountsById, categoriesById } = useLookups();
  const accountFilter = useUi((s) => s.accountFilter);
  const setAccountFilter = useUi((s) => s.setAccountFilter);
  const openNew = useUi((s) => s.openNew);
  const openEdit = useUi((s) => s.openEdit);
  const toast = useUi((s) => s.toast);
  const period = usePeriod();

  const visible = useMemo(
    () => filterTransactions(transactions, period.start, period.end, accountFilter),
    [transactions, period, accountFilter],
  );
  const groups = useMemo(
    () => groupByDay(visible, settings.timeZone),
    [visible, settings.timeZone],
  );

  const filterCurrency =
    accountFilter === 'all'
      ? settings.defaultCurrency
      : (accountsById.get(accountFilter)?.currency ?? settings.defaultCurrency);
  const summary = useMemo(() => summarize(visible, filterCurrency), [visible, filterCurrency]);
  const otherCurrencies = useMemo(
    () => [...new Set(visible.map((t) => t.currency))].filter((c) => c !== filterCurrency),
    [visible, filterCurrency],
  );

  const onDelete = useCallback(
    async (t: Transaction) => {
      await deleteTransaction(t.id);
      toast({
        text: 'Операция удалена',
        action: { label: 'Отменить', run: () => void saveTransaction(t) },
      });
    },
    [deleteTransaction, saveTransaction, toast],
  );

  const activeAccounts = useMemo(
    () => accounts.filter((a) => !a.archived).sort(byOrder),
    [accounts],
  );
  const now = useNow();

  return (
    <Screen
      title="Операции"
      actions={
        accounts.length > 1 ? (
          <Select
            aria-label="Фильтр по счёту"
            className="max-w-[45%] min-w-0 text-sm"
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
          >
            <option value="all">Все счета</option>
            {activeAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        ) : null
      }
      header={<PeriodSwitcher />}
    >
      <ExportReminder />
      <RecurringDue />
      <section aria-label="Итоги периода" className="mb-4 rounded-2xl bg-surface p-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm text-muted">Баланс за период</span>
          <span
            className={`tabular text-xl font-bold ${summary.balance < 0 ? 'text-expense' : ''}`}
          >
            {formatMoney(summary.balance, filterCurrency, { sign: true })}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <SummaryCell
            label="Доходы"
            value={formatMoney(summary.income, filterCurrency)}
            tone="income"
          />
          <SummaryCell
            label="Расходы"
            value={formatMoney(summary.expense, filterCurrency)}
            tone="expense"
          />
        </div>
      </section>
      {otherCurrencies.length > 0 && (
        <p className="-mt-2 mb-3 text-sm text-muted">
          Итоги в {filterCurrency}. Есть операции в других валютах: {otherCurrencies.join(', ')}.
        </p>
      )}

      {accounts.length === 0 ? (
        <EmptyState
          title="Нет счетов"
          text="Создайте счёт на вкладке «Счета», чтобы добавлять операции."
        />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={<ReceiptText size={40} />}
          title="Нет операций за период"
          text="Добавьте первую операцию кнопкой «+»."
          action={<Button onClick={() => openNew('expense')}>Добавить операцию</Button>}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((g) => (
            <section key={g.key} aria-label={dayHeading(g.key, now, settings.timeZone)}>
              <div className="mb-1 flex items-baseline justify-between px-1">
                <h2 className="text-sm font-semibold text-muted first-letter:uppercase">
                  {dayHeading(g.key, now, settings.timeZone)}
                </h2>
                <span className="tabular text-sm font-semibold text-muted">
                  {[...g.totals].map(([cur, v]) => formatMoney(v, cur, { sign: true })).join(' · ')}
                </span>
              </div>
              <ul className="flex flex-col gap-px overflow-hidden rounded-xl">
                {g.items.map((t) => (
                  <TransactionRow
                    key={t.id}
                    transaction={t}
                    accountsById={accountsById}
                    categoriesById={categoriesById}
                    timeZone={settings.timeZone}
                    onOpen={openEdit}
                    onDelete={onDelete}
                  />
                ))}
              </ul>
            </section>
          ))}
          <p className="text-center text-sm text-muted">Свайп влево по операции — удалить</p>
        </div>
      )}

      {accounts.length > 0 && (
        <button
          type="button"
          onClick={() => openNew('expense')}
          aria-label="Добавить операцию"
          className="fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-fg shadow-lg active:scale-95"
        >
          <Plus size={28} />
        </button>
      )}
    </Screen>
  );
}

function SummaryCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'income' | 'expense';
}) {
  const color =
    tone === 'income' ? 'text-income' : tone === 'expense' ? 'text-expense' : 'text-text';
  return (
    <div className="min-w-0 rounded-xl bg-surface-2 px-3 py-2">
      <div className="text-xs text-muted">{label}</div>
      <div className={`tabular text-base font-semibold break-words ${color}`}>{value}</div>
    </div>
  );
}

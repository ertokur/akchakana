import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Plus, Target } from 'lucide-react';
import { addMonths } from 'date-fns';
import { budgetStatus, isBudgetActive, type BudgetStatus } from '../../domain/budgets';
import { daysOfPeriod, formatInTz, monthKey, startOfDayKey } from '../../domain/dates';
import { newId } from '../../domain/ids';
import {
  COMMON_CURRENCIES,
  formatMoney,
  fractionDigits,
  toDecimalString,
  tryParseMinor,
} from '../../domain/money';
import type { Budget } from '../../domain/types';
import { byOrder, useData } from '../../stores/dataStore';
import { useUi } from '../../stores/uiStore';
import { BottomSheet, ConfirmDialog } from '../../ui/BottomSheet';
import {
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  ProgressBar,
  Select,
  TextInput,
} from '../../ui/controls';
import { IconBadge } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { useNow } from '../shared/hooks';

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = addMonths(new Date(y, m - 1, 1), delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function BudgetsScreen() {
  const budgets = useData((s) => s.budgets);
  const categories = useData((s) => s.categories);
  const transactions = useData((s) => s.transactions);
  const timeZone = useData((s) => s.settings.timeZone);
  const now = useNow();
  const currentMonth = monthKey(now, timeZone);
  const [month, setMonth] = useState(currentMonth);
  const [editing, setEditing] = useState<Budget | 'new' | null>(null);

  const statuses = useMemo(
    () =>
      budgets
        .filter((b) => isBudgetActive(b, month))
        .map((b) => budgetStatus(b, month, transactions, categories, timeZone))
        .sort(
          (a, b) =>
            Number(a.budget.categoryId !== null) - Number(b.budget.categoryId !== null) ||
            b.ratio - a.ratio,
        ),
    [budgets, month, transactions, categories, timeZone],
  );

  // Сколько дней осталось в выбранном месяце (для подсказки «в день можно»).
  const monthStart = startOfDayKey(`${month}-01`, timeZone);
  const monthEnd = startOfDayKey(`${shiftMonth(month, 1)}-01`, timeZone);
  const totalDays = daysOfPeriod(
    { kind: 'month', start: monthStart, end: monthEnd },
    timeZone,
  ).length;
  const daysLeft =
    month === currentMonth
      ? daysOfPeriod({ kind: 'month', start: Math.max(monthStart, now), end: monthEnd }, timeZone)
          .length
      : month > currentMonth
        ? totalDays
        : 0;
  const monthLabel = formatInTz(monthStart + 12 * 3600_000, timeZone, 'LLLL yyyy');

  return (
    <Screen
      title="Бюджеты"
      actions={
        <IconButton label="Добавить бюджет" onClick={() => setEditing('new')}>
          <Plus />
        </IconButton>
      }
      header={
        <div className="flex items-center justify-between">
          <IconButton label="Предыдущий месяц" onClick={() => setMonth(shiftMonth(month, -1))}>
            <ChevronLeft />
          </IconButton>
          <span className="font-semibold first-letter:uppercase">{monthLabel}</span>
          <IconButton label="Следующий месяц" onClick={() => setMonth(shiftMonth(month, 1))}>
            <ChevronRight />
          </IconButton>
        </div>
      }
    >
      {statuses.length === 0 ? (
        <EmptyState
          icon={<Target size={40} />}
          title="Бюджетов нет"
          text="Задайте месячный лимит на все расходы или на отдельную категорию."
          action={<Button onClick={() => setEditing('new')}>Добавить бюджет</Button>}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {statuses.map((s) => (
            <li key={s.budget.id}>
              <BudgetCard status={s} daysLeft={daysLeft} onOpen={() => setEditing(s.budget)} />
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <BudgetForm
          budget={editing === 'new' ? undefined : editing}
          month={month}
          onClose={() => setEditing(null)}
        />
      )}
    </Screen>
  );
}

function BudgetCard({
  status,
  daysLeft,
  onOpen,
}: {
  status: BudgetStatus;
  daysLeft: number;
  onOpen: () => void;
}) {
  const categories = useData((s) => s.categories);
  const { budget, spent, limit, level } = status;
  const category = budget.categoryId
    ? categories.find((c) => c.id === budget.categoryId)
    : undefined;
  const name = budget.categoryId ? (category?.name ?? 'Удалённая категория') : 'Все расходы';
  const left = limit - spent;
  const perDay = daysLeft > 0 && left > 0 ? Math.floor(left / daysLeft) : 0;
  return (
    <button type="button" onClick={onOpen} className="w-full text-left">
      <Card className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <IconBadge
            name={category?.icon ?? 'wallet'}
            color={category?.color ?? '#0b6b62'}
            size={36}
          />
          <span className="min-w-0 flex-1 truncate font-semibold">{name}</span>
          {level === 'over' && (
            <span className="flex items-center gap-1 text-sm font-semibold text-expense">
              <AlertTriangle size={16} aria-hidden="true" /> Превышен
            </span>
          )}
          {level === 'warning' && (
            <span className="flex items-center gap-1 text-sm font-semibold text-warning">
              <AlertTriangle size={16} aria-hidden="true" /> Почти исчерпан
            </span>
          )}
        </div>
        <ProgressBar
          value={spent}
          max={limit}
          label={`${name}: потрачено ${Math.round(status.ratio * 100)}%`}
        />
        <div className="tabular flex justify-between text-sm">
          <span>
            {formatMoney(spent, budget.currency)} из {formatMoney(limit, budget.currency)}
          </span>
          <span className={left < 0 ? 'font-semibold text-expense' : 'text-muted'}>
            {left < 0
              ? `перерасход ${formatMoney(-left, budget.currency)}`
              : `осталось ${formatMoney(left, budget.currency)}`}
          </span>
        </div>
        {perDay > 0 && (
          <p className="text-sm text-muted">
            Можно тратить {formatMoney(perDay, budget.currency)} в день ({daysLeft} дн.)
          </p>
        )}
      </Card>
    </button>
  );
}

function BudgetForm({
  budget,
  month,
  onClose,
}: {
  budget?: Budget;
  month: string;
  onClose: () => void;
}) {
  const categories = useData((s) => s.categories);
  const budgets = useData((s) => s.budgets);
  const settings = useData((s) => s.settings);
  const saveBudget = useData((s) => s.saveBudget);
  const deleteBudget = useData((s) => s.deleteBudget);
  const toast = useUi((s) => s.toast);
  const [categoryId, setCategoryId] = useState(budget?.categoryId ?? '');
  const [currency, setCurrency] = useState(budget?.currency ?? settings.defaultCurrency);
  const digits = fractionDigits(currency);
  const [limit, setLimit] = useState(budget ? toDecimalString(budget.limit, digits, ',') : '');
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const options = categories.filter((c) => c.kind === 'expense' && !c.archived).sort(byOrder);

  const save = async () => {
    const value = tryParseMinor(limit, digits);
    if (value === null || value <= 0) return setError('Введите лимит');
    const cat = categoryId || null;
    const duplicate = budgets.some(
      (b) => b.id !== budget?.id && b.categoryId === cat && b.currency === currency,
    );
    if (duplicate) return setError('Такой бюджет уже есть');
    const now = Date.now();
    await saveBudget({
      id: budget?.id ?? newId(),
      categoryId: cat,
      period: 'month',
      limit: value,
      currency,
      startMonth: budget?.startMonth ?? month,
      createdAt: budget?.createdAt ?? now,
      updatedAt: now,
    });
    toast({ text: 'Бюджет сохранён' });
    onClose();
  };

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={budget ? 'Бюджет' : 'Новый бюджет'}
      footer={
        <div className="flex gap-2">
          {budget && (
            <Button variant="danger" onClick={() => setConfirm(true)}>
              Удалить
            </Button>
          )}
          <Button block onClick={save}>
            Сохранить
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="На что">
          {(id) => (
            <Select id={id} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Все расходы</option>
              {options.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.parentId ? `— ${c.name}` : c.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="grid grid-cols-[1fr_7rem] gap-2">
          <Field label="Лимит в месяц">
            {(id) => (
              <TextInput
                id={id}
                inputMode="decimal"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
              />
            )}
          </Field>
          <Field label="Валюта">
            {(id) => (
              <Select id={id} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {COMMON_CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <p className="text-sm text-muted">
          Бюджет действует каждый месяц, начиная с выбранного. Подкатегории учитываются в бюджете
          родителя.
        </p>
        {error && (
          <p role="alert" className="text-sm font-medium text-expense">
            {error}
          </p>
        )}
      </div>
      <ConfirmDialog
        open={confirm}
        title="Удалить бюджет?"
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          if (budget) await deleteBudget(budget.id);
          onClose();
        }}
      />
    </BottomSheet>
  );
}

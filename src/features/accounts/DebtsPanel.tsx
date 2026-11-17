import { useMemo, useState } from 'react';
import { HandCoins } from 'lucide-react';
import { debtPaid, debtRemaining, debtTotals, isDebtOverdue, sortDebts } from '../../domain/debts';
import { dayKey, formatDate, fromDateTimeInput } from '../../domain/dates';
import { newId } from '../../domain/ids';
import {
  COMMON_CURRENCIES,
  formatMoney,
  fractionDigits,
  toDecimalString,
  tryParseMinor,
} from '../../domain/money';
import type { Debt, DebtDirection } from '../../domain/types';
import { useData } from '../../stores/dataStore';
import { useUi } from '../../stores/uiStore';
import { BottomSheet, ConfirmDialog } from '../../ui/BottomSheet';
import {
  Button,
  Card,
  EmptyState,
  Field,
  SegmentedControl,
  Select,
  TextInput,
  Toggle,
} from '../../ui/controls';
import { useT, type DictKey } from '../../i18n';
import { useNow } from '../shared/hooks';

const DIRECTIONS: { value: DebtDirection; label: DictKey }[] = [
  { value: 'owedToMe', label: 'debt.owedToMe' },
  { value: 'iOwe', label: 'debt.iOwe' },
];

export function DebtsPanel({
  creating,
  onCreatingChange,
}: {
  creating: boolean;
  onCreatingChange: (v: boolean) => void;
}) {
  const t = useT();
  const debts = useData((s) => s.debts);
  const timeZone = useData((s) => s.settings.timeZone);
  const defaultCurrency = useData((s) => s.settings.defaultCurrency);
  const [editing, setEditing] = useState<Debt | null>(null);
  const totals = useMemo(() => debtTotals(debts), [debts]);
  const { open, settled } = useMemo(() => sortDebts(debts), [debts]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        {DIRECTIONS.map(({ value, label }) => (
          <Card key={value} className="min-w-0 p-3">
            <div className="text-sm text-muted">{t(label)}</div>
            {totals[value].size === 0 ? (
              <div className="tabular font-semibold text-muted">
                {formatMoney(0, defaultCurrency)}
              </div>
            ) : (
              [...totals[value]].map(([cur, sum]) => {
                const text = formatMoney(sum, cur);
                return (
                  <div
                    key={cur}
                    className={`tabular font-semibold break-words ${text.length > 14 ? 'text-sm' : ''} ${value === 'owedToMe' ? 'text-income' : 'text-expense'}`}
                  >
                    {text}
                  </div>
                );
              })
            )}
          </Card>
        ))}
      </div>
      {debts.length === 0 ? (
        <EmptyState
          icon={<HandCoins size={40} />}
          title={t('debt.empty')}
          text={t('debt.emptyText')}
          action={<Button onClick={() => onCreatingChange(true)}>{t('debt.add')}</Button>}
        />
      ) : (
        <>
          <DebtList debts={open} timeZone={timeZone} onOpen={setEditing} />
          {settled.length > 0 && (
            <details>
              <summary className="min-h-11 cursor-pointer py-2 font-medium text-muted">
                {t('debt.settledList', { count: settled.length })}
              </summary>
              <DebtList debts={settled} timeZone={timeZone} onOpen={setEditing} />
            </details>
          )}
        </>
      )}
      {(creating || editing) && (
        <DebtForm
          debt={editing ?? undefined}
          onClose={() => {
            setEditing(null);
            onCreatingChange(false);
          }}
        />
      )}
    </div>
  );
}

function DebtList({
  debts,
  timeZone,
  onOpen,
}: {
  debts: Debt[];
  timeZone: string;
  onOpen: (d: Debt) => void;
}) {
  const t = useT();
  const now = useNow();
  return (
    <ul className="flex flex-col gap-px overflow-hidden rounded-xl">
      {debts.map((d) => {
        const overdue = isDebtOverdue(d, now);
        const paid = debtPaid(d);
        const tone = d.settled
          ? 'text-muted line-through'
          : d.direction === 'owedToMe'
            ? 'text-income'
            : 'text-expense';
        return (
          <li key={d.id}>
            <button
              type="button"
              onClick={() => onOpen(d)}
              className="flex min-h-16 w-full items-center gap-3 bg-surface px-3 py-2 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{d.person}</span>
                {/* Срок не обрезается: он важнее заметки, заметка — отдельной строкой. */}
                <span className="block text-sm text-muted">
                  {d.direction === 'owedToMe' ? t('debt.owedToMe') : t('debt.iOwe')}
                  {d.dueDate && !d.settled && (
                    <>
                      {' · '}
                      <span
                        className={`whitespace-nowrap ${overdue ? 'font-medium text-expense' : ''}`}
                      >
                        {t(overdue ? 'debt.overdue' : 'debt.until', {
                          date: formatDate(d.dueDate, timeZone, 'dayShortYear'),
                        })}
                      </span>
                    </>
                  )}
                </span>
                {d.note && <span className="block truncate text-sm text-muted">{d.note}</span>}
              </span>
              <span className="flex max-w-[55%] shrink-0 flex-col items-end text-right">
                {/* Закрытый долг — исходная сумма зачёркнутой, открытый — остаток. */}
                <span className={`tabular font-semibold break-words ${tone}`}>
                  {formatMoney(d.settled ? d.amount : debtRemaining(d), d.currency)}
                </span>
                {!d.settled && paid > 0 && (
                  <span className="tabular text-xs text-muted">
                    {t('debt.ofTotal', { amount: formatMoney(d.amount, d.currency) })}
                  </span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function DebtForm({ debt, onClose }: { debt?: Debt; onClose: () => void }) {
  const t = useT();
  const settings = useData((s) => s.settings);
  const saveDebt = useData((s) => s.saveDebt);
  const deleteDebt = useData((s) => s.deleteDebt);
  const toast = useUi((s) => s.toast);
  const [direction, setDirection] = useState<DebtDirection>(debt?.direction ?? 'owedToMe');
  const [person, setPerson] = useState(debt?.person ?? '');
  const [currency, setCurrency] = useState(debt?.currency ?? settings.defaultCurrency);
  const digits = fractionDigits(currency);
  const [amount, setAmount] = useState(debt ? toDecimalString(debt.amount, digits, ',') : '');
  const [due, setDue] = useState(debt?.dueDate ? dayKey(debt.dueDate, settings.timeZone) : '');
  const [note, setNote] = useState(debt?.note ?? '');
  const [settled, setSettled] = useState(debt?.settled ?? false);
  const [payments, setPayments] = useState(debt?.payments ?? []);
  const [payment, setPayment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const parsedAmount = tryParseMinor(amount, digits);
  const formRemaining =
    parsedAmount === null
      ? null
      : Math.max(0, parsedAmount - payments.reduce((sum, p) => sum + p.amount, 0));

  const addPayment = () => {
    const value = tryParseMinor(payment, digits);
    if (value === null || value <= 0) return setError(t('debt.invalidPayment'));
    setPayments([...payments, { date: Date.now(), amount: value }]);
    setPayment('');
    setError(null);
  };

  const save = async () => {
    if (!person.trim()) return setError(t('debt.enterPerson'));
    const value = tryParseMinor(amount, digits);
    if (value === null || value <= 0) return setError(t('debt.enterAmount'));
    const now = Date.now();
    const next: Debt = {
      id: debt?.id ?? newId(),
      direction,
      person: person.trim(),
      amount: value,
      currency,
      accountId: debt?.accountId,
      dueDate: due ? fromDateTimeInput(`${due}T12:00`, settings.timeZone) : undefined,
      note: note.trim(),
      payments,
      settled,
      createdAt: debt?.createdAt ?? now,
      updatedAt: now,
    };
    if (debtRemaining(next) === 0) next.settled = true;
    await saveDebt(next);
    toast({ text: next.settled && !debt?.settled ? t('debt.closed') : t('debt.saved') });
    onClose();
  };

  return (
    <BottomSheet
      open
      tall
      onClose={onClose}
      title={debt ? t('debt.title') : t('debt.new')}
      footer={
        <div className="flex gap-2">
          {debt && (
            <Button variant="danger" onClick={() => setConfirm(true)}>
              {t('common.delete')}
            </Button>
          )}
          <Button block onClick={save}>
            {t('common.save')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <SegmentedControl
          label={t('debt.direction')}
          value={direction}
          options={DIRECTIONS.map((o) => ({ value: o.value, label: t(o.label) }))}
          onChange={setDirection}
        />
        <Field label={direction === 'owedToMe' ? t('debt.whoOwes') : t('debt.whomIOwe')}>
          {(id) => <TextInput id={id} value={person} onChange={(e) => setPerson(e.target.value)} />}
        </Field>
        <div className="grid grid-cols-[1fr_7rem] gap-2">
          <Field label={t('editor.amount')}>
            {(id) => (
              <TextInput
                id={id}
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            )}
          </Field>
          <Field label={t('common.currency')}>
            {(id) => (
              <Select id={id} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {COMMON_CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Field label={t('debt.dueDate')}>
          {(id) => (
            <TextInput id={id} type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          )}
        </Field>
        <Field label={t('common.note')}>
          {(id) => <TextInput id={id} value={note} onChange={(e) => setNote(e.target.value)} />}
        </Field>
        <div className="flex flex-col gap-2">
          <span className="flex items-baseline justify-between gap-2 text-sm font-medium text-muted">
            {t('debt.payments')}
            {payments.length > 0 && formRemaining !== null && (
              <span className="tabular">
                {t('debt.remaining', { amount: formatMoney(formRemaining, currency) })}
              </span>
            )}
          </span>
          {payments.length > 0 && (
            <ul className="flex flex-col gap-1">
              {payments.map((p, i) => (
                <li
                  key={i}
                  className="flex min-h-11 items-center justify-between rounded-lg bg-surface-2 px-3"
                >
                  <span className="text-sm">
                    {formatDate(p.date, settings.timeZone, 'dayShortYear')}
                  </span>
                  <span className="tabular min-w-0 font-medium break-words">
                    {formatMoney(p.amount, currency)}
                  </span>
                  <button
                    type="button"
                    className="min-h-11 px-2 text-sm text-expense"
                    onClick={() => setPayments(payments.filter((_, j) => j !== i))}
                  >
                    {t('debt.removePayment')}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <TextInput
              aria-label={t('debt.paymentAmount')}
              inputMode="decimal"
              placeholder={t('debt.paymentAmount')}
              value={payment}
              onChange={(e) => setPayment(e.target.value)}
            />
            <Button variant="secondary" onClick={addPayment}>
              {t('common.add')}
            </Button>
          </div>
        </div>
        <Toggle checked={settled} onChange={setSettled} label={t('debt.closed')} />
        {error && (
          <p role="alert" className="text-sm font-medium text-expense">
            {error}
          </p>
        )}
      </div>
      <ConfirmDialog
        open={confirm}
        title={t('debt.deleteConfirm')}
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          if (debt) await deleteDebt(debt.id);
          onClose();
        }}
      />
    </BottomSheet>
  );
}

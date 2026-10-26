import { useMemo, useState } from 'react';
import { HandCoins } from 'lucide-react';
import { debtRemaining, debtTotals } from '../../domain/debts';
import { dayKey, formatInTz, fromDateTimeInput } from '../../domain/dates';
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

const DIRECTIONS: { value: DebtDirection; label: string }[] = [
  { value: 'owedToMe', label: 'Мне должны' },
  { value: 'iOwe', label: 'Я должен' },
];

export function DebtsPanel({
  creating,
  onCreatingChange,
}: {
  creating: boolean;
  onCreatingChange: (v: boolean) => void;
}) {
  const debts = useData((s) => s.debts);
  const timeZone = useData((s) => s.settings.timeZone);
  const [editing, setEditing] = useState<Debt | null>(null);
  const totals = useMemo(() => debtTotals(debts), [debts]);
  const open = debts
    .filter((d) => !d.settled)
    .sort((a, b) => (a.dueDate ?? Infinity) - (b.dueDate ?? Infinity));
  const settled = debts.filter((d) => d.settled);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        {DIRECTIONS.map(({ value, label }) => (
          <Card key={value} className="p-3">
            <div className="text-sm text-muted">{label}</div>
            {totals[value].size === 0 ? (
              <div className="tabular font-semibold">0</div>
            ) : (
              [...totals[value]].map(([cur, sum]) => (
                <div
                  key={cur}
                  className={`tabular font-semibold ${value === 'owedToMe' ? 'text-income' : 'text-expense'}`}
                >
                  {formatMoney(sum, cur)}
                </div>
              ))
            )}
          </Card>
        ))}
      </div>
      {debts.length === 0 ? (
        <EmptyState
          icon={<HandCoins size={40} />}
          title="Долгов нет"
          text="Записывайте, кто и сколько вам должен и кому должны вы."
          action={<Button onClick={() => onCreatingChange(true)}>Добавить долг</Button>}
        />
      ) : (
        <>
          <DebtList debts={open} timeZone={timeZone} onOpen={setEditing} />
          {settled.length > 0 && (
            <details>
              <summary className="min-h-11 cursor-pointer py-2 font-medium text-muted">
                Закрытые ({settled.length})
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
  return (
    <ul className="flex flex-col gap-px overflow-hidden rounded-xl">
      {debts.map((d) => (
        <li key={d.id}>
          <button
            type="button"
            onClick={() => onOpen(d)}
            className="flex min-h-16 w-full items-center gap-3 bg-surface px-3 py-2 text-left"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{d.person}</span>
              <span className="block truncate text-sm text-muted">
                {d.direction === 'owedToMe' ? 'Мне должны' : 'Я должен'}
                {d.dueDate ? ` · до ${formatInTz(d.dueDate, timeZone, 'd MMM yyyy')}` : ''}
                {d.note ? ` · ${d.note}` : ''}
              </span>
            </span>
            <span
              className={`tabular font-semibold ${d.settled ? 'text-muted line-through' : d.direction === 'owedToMe' ? 'text-income' : 'text-expense'}`}
            >
              {formatMoney(debtRemaining(d), d.currency)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function DebtForm({ debt, onClose }: { debt?: Debt; onClose: () => void }) {
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

  const addPayment = () => {
    const value = tryParseMinor(payment, digits);
    if (value === null || value <= 0) return setError('Неверная сумма погашения');
    setPayments([...payments, { date: Date.now(), amount: value }]);
    setPayment('');
    setError(null);
  };

  const save = async () => {
    if (!person.trim()) return setError('Укажите, кто должен или кому');
    const value = tryParseMinor(amount, digits);
    if (value === null || value <= 0) return setError('Введите сумму долга');
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
    toast({ text: next.settled && !debt?.settled ? 'Долг закрыт' : 'Долг сохранён' });
    onClose();
  };

  return (
    <BottomSheet
      open
      tall
      onClose={onClose}
      title={debt ? 'Долг' : 'Новый долг'}
      footer={
        <div className="flex gap-2">
          {debt && (
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
        <SegmentedControl
          label="Направление"
          value={direction}
          options={DIRECTIONS}
          onChange={setDirection}
        />
        <Field label={direction === 'owedToMe' ? 'Кто должен' : 'Кому должен'}>
          {(id) => <TextInput id={id} value={person} onChange={(e) => setPerson(e.target.value)} />}
        </Field>
        <div className="grid grid-cols-[1fr_7rem] gap-2">
          <Field label="Сумма">
            {(id) => (
              <TextInput
                id={id}
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
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
        <Field label="Вернуть до">
          {(id) => (
            <TextInput id={id} type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          )}
        </Field>
        <Field label="Заметка">
          {(id) => <TextInput id={id} value={note} onChange={(e) => setNote(e.target.value)} />}
        </Field>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-muted">Погашения</span>
          {payments.length > 0 && (
            <ul className="flex flex-col gap-1">
              {payments.map((p, i) => (
                <li
                  key={i}
                  className="flex min-h-11 items-center justify-between rounded-lg bg-surface-2 px-3"
                >
                  <span className="text-sm">
                    {formatInTz(p.date, settings.timeZone, 'd MMM yyyy')}
                  </span>
                  <span className="tabular font-medium">{formatMoney(p.amount, currency)}</span>
                  <button
                    type="button"
                    className="min-h-11 px-2 text-sm text-expense"
                    onClick={() => setPayments(payments.filter((_, j) => j !== i))}
                  >
                    Убрать
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <TextInput
              aria-label="Сумма погашения"
              inputMode="decimal"
              placeholder="Сумма погашения"
              value={payment}
              onChange={(e) => setPayment(e.target.value)}
            />
            <Button variant="secondary" onClick={addPayment}>
              Добавить
            </Button>
          </div>
        </div>
        <Toggle checked={settled} onChange={setSettled} label="Долг закрыт" />
        {error && (
          <p role="alert" className="text-sm font-medium text-expense">
            {error}
          </p>
        )}
      </div>
      <ConfirmDialog
        open={confirm}
        title="Удалить долг?"
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          if (debt) await deleteDebt(debt.id);
          onClose();
        }}
      />
    </BottomSheet>
  );
}

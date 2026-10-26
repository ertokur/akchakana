import { useMemo, useState } from 'react';
import { Bell, Plus, Repeat } from 'lucide-react';
import { navigate } from '../../app/router';
import { dayKey, formatInTz, fromDateTimeInput } from '../../domain/dates';
import { newId } from '../../domain/ids';
import { describeRule, FREQ_LABELS, nextOccurrenceAfter } from '../../domain/recurrence';
import { formatMoney, fractionDigits, toDecimalString, tryParseMinor } from '../../domain/money';
import type { RecurrenceFreq, RecurringRule, TransactionType } from '../../domain/types';
import { byOrder, useData } from '../../stores/dataStore';
import { useUi } from '../../stores/uiStore';
import { BottomSheet, ConfirmDialog } from '../../ui/BottomSheet';
import {
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  SegmentedControl,
  Select,
  TextInput,
  Toggle,
} from '../../ui/controls';
import { Screen } from '../../ui/Screen';
import { categoryTitle, useLookups } from '../shared/hooks';
import { notificationsSupported, requestNotificationPermission } from './notifications';

export function RecurringScreen() {
  const recurring = useData((s) => s.recurring);
  const settings = useData((s) => s.settings);
  const updateSettings = useData((s) => s.updateSettings);
  const toast = useUi((s) => s.toast);
  const { accountsById, categoriesById } = useLookups();
  const [editing, setEditing] = useState<RecurringRule | 'new' | null>(null);
  const sorted = useMemo(
    () =>
      [...recurring].sort((a, b) => Number(b.active) - Number(a.active) || a.nextDate - b.nextDate),
    [recurring],
  );

  const enableNotifications = async () => {
    const granted = await requestNotificationPermission();
    await updateSettings({ notificationsEnabled: granted });
    toast(
      granted
        ? { text: 'Уведомления включены' }
        : { text: 'Браузер не разрешил уведомления', tone: 'warning' },
    );
  };

  return (
    <Screen
      title="Регулярные платежи"
      onBack={() => navigate('more')}
      actions={
        <IconButton label="Добавить правило" onClick={() => setEditing('new')}>
          <Plus />
        </IconButton>
      }
    >
      <div className="flex flex-col gap-4">
        {notificationsSupported() && !settings.notificationsEnabled && (
          <Card className="flex items-center gap-3">
            <Bell size={20} aria-hidden="true" className="shrink-0 text-accent" />
            <p className="flex-1 text-sm">
              Напоминания приходят, когда приложение открыто или работает в фоне.
            </p>
            <Button variant="secondary" onClick={enableNotifications}>
              Включить
            </Button>
          </Card>
        )}
        {sorted.length === 0 ? (
          <EmptyState
            icon={<Repeat size={40} />}
            title="Нет регулярных платежей"
            text="Добавьте подписки, аренду или зарплату — приложение напомнит или добавит операцию само."
            action={<Button onClick={() => setEditing('new')}>Добавить</Button>}
          />
        ) : (
          <ul className="flex flex-col gap-px overflow-hidden rounded-xl">
            {sorted.map((r) => {
              const account = accountsById.get(r.template.accountId);
              const subtitle =
                r.template.type === 'transfer'
                  ? `Перевод → ${accountsById.get(r.template.toAccountId ?? '')?.name ?? '?'}`
                  : categoryTitle(categoriesById.get(r.template.categoryId ?? ''), categoriesById);
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setEditing(r)}
                    className={`flex min-h-16 w-full items-center gap-3 bg-surface px-3 py-2 text-left ${r.active ? '' : 'opacity-60'}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{r.name}</span>
                      <span className="block truncate text-sm text-muted">
                        {describeRule(r)} · {subtitle} · {account?.name ?? '?'}
                      </span>
                      <span className="block text-sm text-muted">
                        {r.active
                          ? `${r.mode === 'auto' ? 'Добавится' : 'Напомнить'} ${formatInTz(r.nextDate, settings.timeZone, 'd MMMM yyyy')}`
                          : 'Отключено'}
                      </span>
                    </span>
                    <span className="tabular font-semibold">
                      {formatMoney(r.template.amount, r.template.currency)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {editing && (
        <RuleForm rule={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />
      )}
    </Screen>
  );
}

function RuleForm({ rule, onClose }: { rule?: RecurringRule; onClose: () => void }) {
  const accounts = useData((s) => s.accounts);
  const categories = useData((s) => s.categories);
  const settings = useData((s) => s.settings);
  const saveRecurring = useData((s) => s.saveRecurring);
  const deleteRecurring = useData((s) => s.deleteRecurring);
  const toast = useUi((s) => s.toast);
  const active = useMemo(() => accounts.filter((a) => !a.archived).sort(byOrder), [accounts]);

  const [name, setName] = useState(rule?.name ?? '');
  const [type, setType] = useState<TransactionType>(rule?.template.type ?? 'expense');
  const [accountId, setAccountId] = useState(rule?.template.accountId ?? active[0]?.id ?? '');
  const [toAccountId, setToAccountId] = useState(rule?.template.toAccountId ?? '');
  const [categoryId, setCategoryId] = useState(rule?.template.categoryId ?? '');
  const account = accounts.find((a) => a.id === accountId);
  const digits = fractionDigits(account?.currency ?? settings.defaultCurrency);
  const [amount, setAmount] = useState(
    rule ? toDecimalString(rule.template.amount, digits, ',') : '',
  );
  const [freq, setFreq] = useState<RecurrenceFreq>(rule?.freq ?? 'month');
  const [interval, setIntervalText] = useState(String(rule?.interval ?? 1));
  const [start, setStart] = useState(() => dayKey(rule?.nextDate ?? Date.now(), settings.timeZone));
  const [end, setEnd] = useState(rule?.endDate ? dayKey(rule.endDate, settings.timeZone) : '');
  const [mode, setMode] = useState<RecurringRule['mode']>(rule?.mode ?? 'remind');
  const [isActive, setIsActive] = useState(rule?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  const categoryOptions = categories.filter((c) => c.kind === type && !c.archived).sort(byOrder);

  const save = async () => {
    if (!name.trim()) return setError('Введите название');
    if (!account) return setError('Выберите счёт');
    const value = tryParseMinor(amount, digits);
    if (value === null || value <= 0) return setError('Введите сумму');
    if (type === 'transfer' && (!toAccountId || toAccountId === accountId))
      return setError('Выберите другой счёт зачисления');
    if (type !== 'transfer' && !categoryId) return setError('Выберите категорию');
    const n = Number.parseInt(interval, 10);
    if (!Number.isFinite(n) || n < 1 || n > 365) return setError('Интервал — от 1 до 365');
    const now = Date.now();
    const startDate = fromDateTimeInput(`${start}T10:00`, settings.timeZone);
    const endDate = end ? fromDateTimeInput(`${end}T23:59`, settings.timeZone) : undefined;
    if (endDate !== undefined && endDate < startDate)
      return setError('Дата окончания раньше начала');
    const base = { startDate, freq, interval: n, endDate };
    const next: RecurringRule = {
      id: rule?.id ?? newId(),
      name: name.trim(),
      template: {
        type,
        accountId,
        toAccountId: type === 'transfer' ? toAccountId : undefined,
        categoryId: type === 'transfer' ? undefined : categoryId,
        amount: value,
        currency: account.currency,
        note: rule?.template.note ?? '',
        tags: rule?.template.tags ?? [],
      },
      ...base,
      // Первое повторение — сама дата начала.
      nextDate: nextOccurrenceAfter(base, startDate - 1, settings.timeZone) ?? startDate,
      mode,
      active: isActive,
      lastNotifiedAt: undefined,
      createdAt: rule?.createdAt ?? now,
      updatedAt: now,
    };
    await saveRecurring(next);
    toast({ text: 'Правило сохранено' });
    onClose();
  };

  return (
    <BottomSheet
      open
      tall
      onClose={onClose}
      title={rule ? 'Регулярный платёж' : 'Новый регулярный платёж'}
      footer={
        <div className="flex gap-2">
          {rule && (
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
        <Field label="Название">
          {(id) => (
            <TextInput
              id={id}
              placeholder="Например, Интернет"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
        </Field>
        <SegmentedControl
          label="Тип"
          value={type}
          options={[
            { value: 'expense', label: 'Расход' },
            { value: 'income', label: 'Доход' },
            { value: 'transfer', label: 'Перевод' },
          ]}
          onChange={(v) => {
            setType(v);
            setCategoryId('');
          }}
        />
        <Field label={type === 'transfer' ? 'Со счёта' : 'Счёт'}>
          {(id) => (
            <Select id={id} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {active.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.currency})
                </option>
              ))}
            </Select>
          )}
        </Field>
        {type === 'transfer' ? (
          <Field label="На счёт">
            {(id) => (
              <Select id={id} value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
                <option value="">Выберите</option>
                {active
                  .filter((a) => a.id !== accountId && a.currency === account?.currency)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </Select>
            )}
          </Field>
        ) : (
          <Field label="Категория">
            {(id) => (
              <Select id={id} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Выберите</option>
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.parentId ? `— ${c.name}` : c.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        <Field label={`Сумма, ${account?.currency ?? settings.defaultCurrency}`}>
          {(id) => (
            <TextInput
              id={id}
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          )}
        </Field>
        <div className="grid grid-cols-[1fr_6rem] gap-2">
          <Field label="Повтор">
            {(id) => (
              <Select
                id={id}
                value={freq}
                onChange={(e) => setFreq(e.target.value as RecurrenceFreq)}
              >
                {Object.entries(FREQ_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Интервал">
            {(id) => (
              <TextInput
                id={id}
                inputMode="numeric"
                value={interval}
                onChange={(e) => setIntervalText(e.target.value)}
              />
            )}
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Первый платёж">
            {(id) => (
              <TextInput
                id={id}
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            )}
          </Field>
          <Field label="Окончание">
            {(id) => (
              <TextInput id={id} type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            )}
          </Field>
        </div>
        <SegmentedControl
          label="Режим"
          value={mode}
          options={[
            { value: 'remind', label: 'Напоминать' },
            { value: 'auto', label: 'Добавлять сам' },
          ]}
          onChange={setMode}
        />
        <p className="-mt-2 text-sm text-muted">
          {mode === 'remind'
            ? 'В срок появится карточка с кнопкой «Добавить операцию» и уведомление.'
            : 'Операция добавится автоматически при открытии приложения в день платежа или позже.'}
        </p>
        {rule && <Toggle checked={isActive} onChange={setIsActive} label="Правило активно" />}
        {error && (
          <p role="alert" className="text-sm font-medium text-expense">
            {error}
          </p>
        )}
      </div>
      <ConfirmDialog
        open={confirm}
        title="Удалить правило?"
        text="Уже созданные операции останутся."
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          if (rule) await deleteRecurring(rule.id);
          onClose();
        }}
      />
    </BottomSheet>
  );
}

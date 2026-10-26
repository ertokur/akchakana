import { useState } from 'react';
import { ACCOUNT_KIND_ICONS, ACCOUNT_KIND_LABELS, makeAccount, PALETTE } from '../../db/seed';
import {
  COMMON_CURRENCIES,
  fractionDigits,
  toDecimalString,
  tryParseMinor,
} from '../../domain/money';
import type { Account, AccountKind } from '../../domain/types';
import { useData } from '../../stores/dataStore';
import { useUi } from '../../stores/uiStore';
import { BottomSheet, ConfirmDialog } from '../../ui/BottomSheet';
import { Button, Field, Select, TextInput, Toggle } from '../../ui/controls';
import { ColorPicker, IconPicker } from '../../ui/pickers';
import { getRepositories } from '../../repositories';

export function AccountForm({ account, onClose }: { account?: Account; onClose: () => void }) {
  const accounts = useData((s) => s.accounts);
  const settings = useData((s) => s.settings);
  const saveAccount = useData((s) => s.saveAccount);
  const deleteAccount = useData((s) => s.deleteAccount);
  const hasTransactions = useData((s) =>
    account
      ? s.transactions.some((t) => t.accountId === account.id || t.toAccountId === account.id)
      : false,
  );
  const toast = useUi((s) => s.toast);

  const [name, setName] = useState(account?.name ?? '');
  const [kind, setKind] = useState<AccountKind>(account?.kind ?? 'card');
  const [currency, setCurrency] = useState(account?.currency ?? settings.defaultCurrency);
  const digits = fractionDigits(currency);
  const [balance, setBalance] = useState(
    account ? toDecimalString(account.initialBalance, digits, ',') : '',
  );
  const [limit, setLimit] = useState(
    account?.creditLimit !== undefined ? toDecimalString(account.creditLimit, digits, ',') : '',
  );
  const [color, setColor] = useState(account?.color ?? PALETTE[accounts.length % PALETTE.length]);
  const [icon, setIcon] = useState(account?.icon ?? ACCOUNT_KIND_ICONS.card);
  const [archived, setArchived] = useState(account?.archived ?? false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  const currencies = COMMON_CURRENCIES.includes(currency)
    ? COMMON_CURRENCIES
    : [currency, ...COMMON_CURRENCIES];

  const save = async () => {
    if (!name.trim()) return setError('Введите название');
    const initialBalance = balance.trim() === '' ? 0 : tryParseMinor(balance, digits);
    if (initialBalance === null) return setError('Неверный начальный баланс');
    const creditLimit = limit.trim() === '' ? undefined : tryParseMinor(limit, digits);
    if (creditLimit === null) return setError('Неверный кредитный лимит');
    const now = Date.now();
    const base = account ?? makeAccount({ name, currency }, now);
    await saveAccount({
      ...base,
      name: name.trim(),
      kind,
      currency,
      initialBalance,
      creditLimit: kind === 'credit' ? creditLimit : undefined,
      color,
      icon,
      archived,
      order: account ? account.order : Math.max(-1, ...accounts.map((a) => a.order)) + 1,
      updatedAt: now,
    });
    toast({ text: account ? 'Счёт сохранён' : 'Счёт создан' });
    onClose();
  };

  const remove = async () => {
    if (!account) return;
    const refs = await getRepositories().transactions.countReferences(account.id);
    if (refs > 0) {
      setConfirm(false);
      return setError(`По счёту есть операции (${refs}). Скройте его вместо удаления.`);
    }
    await deleteAccount(account.id);
    toast({ text: 'Счёт удалён' });
    onClose();
  };

  return (
    <BottomSheet
      open
      tall
      onClose={onClose}
      title={account ? 'Счёт' : 'Новый счёт'}
      footer={
        <div className="flex gap-2">
          {account && (
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
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus={!account}
            />
          )}
        </Field>
        <Field label="Тип">
          {(id) => (
            <Select
              id={id}
              value={kind}
              onChange={(e) => {
                const k = e.target.value as AccountKind;
                setKind(k);
                if (Object.values(ACCOUNT_KIND_ICONS).includes(icon))
                  setIcon(ACCOUNT_KIND_ICONS[k]);
              }}
            >
              {Object.entries(ACCOUNT_KIND_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field
          label="Валюта"
          hint={hasTransactions ? 'Валюту нельзя менять, пока по счёту есть операции' : undefined}
        >
          {(id) => (
            <Select
              id={id}
              value={currency}
              disabled={hasTransactions}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {currencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Начальный баланс">
          {(id) => (
            <TextInput
              id={id}
              inputMode="decimal"
              placeholder="0"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
            />
          )}
        </Field>
        {kind === 'credit' && (
          <Field label="Кредитный лимит">
            {(id) => (
              <TextInput
                id={id}
                inputMode="decimal"
                placeholder="0"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
              />
            )}
          </Field>
        )}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-muted">Цвет</span>
          <ColorPicker value={color} onChange={setColor} />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-muted">Иконка</span>
          <IconPicker value={icon} color={color} onChange={setIcon} />
        </div>
        {account && (
          <Toggle
            checked={archived}
            onChange={setArchived}
            label="Скрыть счёт"
            description="Скрытый счёт не участвует в общем балансе и не предлагается в новых операциях"
          />
        )}
        {error && (
          <p role="alert" className="text-sm font-medium text-expense">
            {error}
          </p>
        )}
      </div>
      <ConfirmDialog
        open={confirm}
        title="Удалить счёт?"
        text="Удалить можно только счёт без операций."
        onCancel={() => setConfirm(false)}
        onConfirm={remove}
      />
    </BottomSheet>
  );
}

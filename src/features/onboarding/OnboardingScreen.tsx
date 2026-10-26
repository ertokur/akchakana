import { useState } from 'react';
import { FileUp, Wallet } from 'lucide-react';
import { ACCOUNT_KIND_LABELS, defaultCategories, makeAccount, PALETTE } from '../../db/seed';
import { COMMON_CURRENCIES, fractionDigits, tryParseMinor } from '../../domain/money';
import type { AccountKind } from '../../domain/types';
import { useData } from '../../stores/dataStore';
import { Button, Field, Select, TextInput } from '../../ui/controls';
import { navigate } from '../../app/router';

/** Первый запуск: валюта и первый счёт, либо импорт резервной копии 1Money. */
export function OnboardingScreen() {
  const settings = useData((s) => s.settings);
  const updateSettings = useData((s) => s.updateSettings);
  const saveAccount = useData((s) => s.saveAccount);
  const saveCategories = useData((s) => s.saveCategories);
  const hasCategories = useData((s) => s.categories.length > 0);
  const [currency, setCurrency] = useState(settings.defaultCurrency);
  const [name, setName] = useState('Наличные');
  const [kind, setKind] = useState<AccountKind>('cash');
  const [balance, setBalance] = useState('');
  const [error, setError] = useState<string | null>(null);

  const finish = async () => {
    const initialBalance =
      balance.trim() === '' ? 0 : tryParseMinor(balance, fractionDigits(currency));
    if (initialBalance === null) return setError('Неверный начальный баланс');
    if (!name.trim()) return setError('Введите название счёта');
    if (!hasCategories) await saveCategories(defaultCategories());
    await saveAccount(
      makeAccount({ name: name.trim(), currency, kind, initialBalance, color: PALETTE[0] }),
    );
    await requestPersistentStorage();
    await updateSettings({ defaultCurrency: currency, onboarded: true });
  };

  const importInstead = async () => {
    await updateSettings({ defaultCurrency: currency });
    navigate('import');
  };

  return (
    <div className="pt-safe pb-safe pl-safe pr-safe mx-auto flex min-h-dvh max-w-lg flex-col gap-6 px-5 py-8">
      <div className="flex flex-col items-center gap-3 pt-6 text-center">
        <img src="/logo.svg" alt="" width={72} height={72} className="rounded-2xl" />
        <h1 className="text-2xl font-bold">Акчакана</h1>
        <p className="max-w-xs text-muted">
          Личный учёт денег. Все данные хранятся только на этом устройстве и работают без интернета.
        </p>
      </div>

      <section
        aria-labelledby="first-account"
        className="flex flex-col gap-4 rounded-2xl bg-surface p-4"
      >
        <h2 id="first-account" className="flex items-center gap-2 text-lg font-semibold">
          <Wallet size={20} aria-hidden="true" /> Первый счёт
        </h2>
        <Field label="Основная валюта">
          {(id) => (
            <Select id={id} value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {COMMON_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Название счёта">
          {(id) => <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label="Тип">
          {(id) => (
            <Select id={id} value={kind} onChange={(e) => setKind(e.target.value as AccountKind)}>
              {Object.entries(ACCOUNT_KIND_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Текущий баланс" error={error ?? undefined}>
          {(id) => (
            <TextInput
              id={id}
              inputMode="decimal"
              placeholder="0"
              value={balance}
              onChange={(e) => {
                setBalance(e.target.value);
                setError(null);
              }}
            />
          )}
        </Field>
        <Button block onClick={finish}>
          Начать
        </Button>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-dashed border-border p-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <FileUp size={20} aria-hidden="true" /> Уже вели учёт в 1Money?
        </h2>
        <p className="text-sm text-muted">
          Импортируйте резервную копию: счета, категории и операции перенесутся. Файл только
          читается и никуда не отправляется.
        </p>
        <Button variant="secondary" onClick={importInstead}>
          Импортировать резервную копию
        </Button>
      </section>
    </div>
  );
}

/** Просим браузер не очищать IndexedDB при нехватке места. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

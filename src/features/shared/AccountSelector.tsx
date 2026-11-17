import { useMemo, useState } from 'react';
import { ChevronDown, Wallet } from 'lucide-react';
import { totalsByCurrency } from '../../domain/balances';
import { formatMoney } from '../../domain/money';
import { byOrder, useData } from '../../stores/dataStore';
import { useUi } from '../../stores/uiStore';
import { BottomSheet } from '../../ui/BottomSheet';
import { IconBadge } from '../../ui/Icon';
import { useBalances } from './hooks';

/** Верх экрана как в 1Money: выбранный счёт (или «Все счета») и его баланс; нажатие — выбор счёта. */
export function AccountSelector() {
  const accounts = useData((s) => s.accounts);
  const defaultCurrency = useData((s) => s.settings.defaultCurrency);
  const accountFilter = useUi((s) => s.accountFilter);
  const setAccountFilter = useUi((s) => s.setAccountFilter);
  const balances = useBalances();
  const [open, setOpen] = useState(false);
  const active = useMemo(() => accounts.filter((a) => !a.archived).sort(byOrder), [accounts]);
  const totals = useMemo(() => totalsByCurrency(accounts, balances), [accounts, balances]);
  const current = accounts.find((a) => a.id === accountFilter);

  const totalText = current
    ? formatMoney(balances.get(current.id) ?? 0, current.currency)
    : [...totals].length
      ? [...totals].map(([cur, v]) => formatMoney(v, cur)).join(' · ')
      : formatMoney(0, defaultCurrency);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-12 w-full flex-col items-center justify-center rounded-xl px-2"
        aria-label={`Счёт: ${current?.name ?? 'Все счета'}, баланс ${totalText}. Выбрать счёт`}
      >
        <span className="flex items-center gap-1 text-sm text-muted">
          {current?.name ?? 'Все счета'} <ChevronDown size={16} aria-hidden="true" />
        </span>
        <span className="tabular text-lg font-bold">{totalText}</span>
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Счёт">
        <ul className="flex flex-col gap-1">
          <li>
            <button
              type="button"
              onClick={() => {
                setAccountFilter('all');
                setOpen(false);
              }}
              aria-current={accountFilter === 'all'}
              className={`flex min-h-14 w-full items-center gap-3 rounded-xl px-3 text-left ${accountFilter === 'all' ? 'bg-accent-soft' : ''}`}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-fg">
                <Wallet size={18} aria-hidden="true" />
              </span>
              <span className="flex-1 font-medium">Все счета</span>
            </button>
          </li>
          {active.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => {
                  setAccountFilter(a.id);
                  setOpen(false);
                }}
                aria-current={accountFilter === a.id}
                className={`flex min-h-14 w-full items-center gap-3 rounded-xl px-3 text-left ${accountFilter === a.id ? 'bg-accent-soft' : ''}`}
              >
                <IconBadge name={a.icon} color={a.color} size={36} />
                <span className="flex-1 truncate font-medium">{a.name}</span>
                <span className="tabular text-sm text-muted">
                  {formatMoney(balances.get(a.id) ?? 0, a.currency)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </BottomSheet>
    </>
  );
}

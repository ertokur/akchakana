import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { formatMoney } from '../../domain/money';
import type { Account, Id } from '../../domain/types';
import { BottomSheet } from '../../ui/BottomSheet';
import { IconBadge } from '../../ui/Icon';
import { useBalances } from '../shared/hooks';

export function AccountPicker({
  label,
  accounts,
  value,
  onChange,
  exclude,
}: {
  label: string;
  accounts: Account[];
  value?: Id;
  onChange: (id: Id) => void;
  exclude?: Id;
}) {
  const [open, setOpen] = useState(false);
  const balances = useBalances();
  const current = accounts.find((a) => a.id === value);
  const options = accounts.filter((a) => a.id !== exclude && (!a.archived || a.id === value));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl bg-surface-2 px-3 text-left"
        aria-label={`${label}: ${current?.name ?? 'не выбран'}`}
      >
        {current && <IconBadge name={current.icon} color={current.color} size={24} />}
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-muted">{label}</span>
          <span className="block truncate text-sm font-medium">{current?.name ?? 'Выберите'}</span>
        </span>
        <ChevronDown size={18} className="text-muted" />
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title={label}>
        <ul className="flex flex-col gap-1">
          {options.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(a.id);
                  setOpen(false);
                }}
                aria-current={a.id === value}
                className={`flex min-h-14 w-full items-center gap-3 rounded-xl px-3 text-left ${a.id === value ? 'bg-accent-soft' : 'hover:bg-surface-2'}`}
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

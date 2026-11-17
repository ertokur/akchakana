import { formatMoney } from '../../domain/money';
import type { Account, Id } from '../../domain/types';
import { BottomSheet } from '../../ui/BottomSheet';
import { IconBadge } from '../../ui/Icon';
import { useBalances } from '../shared/hooks';

/** Шторка выбора счёта с балансами. */
export function AccountPickerSheet({
  open,
  title,
  accounts,
  value,
  onChange,
  onClose,
  exclude,
}: {
  open: boolean;
  title: string;
  accounts: Account[];
  value?: Id;
  onChange: (id: Id) => void;
  onClose: () => void;
  exclude?: Id;
}) {
  const balances = useBalances();
  const options = accounts.filter((a) => a.id !== exclude && (!a.archived || a.id === value));
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <ul className="flex flex-col gap-1">
        {options.map((a) => (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => {
                onChange(a.id);
                onClose();
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
  );
}

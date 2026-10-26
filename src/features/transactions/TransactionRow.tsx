import { memo } from 'react';
import { Trash2 } from 'lucide-react';
import { formatInTz } from '../../domain/dates';
import { formatMoney } from '../../domain/money';
import type { Account, Category, Id, Transaction } from '../../domain/types';
import { IconBadge } from '../../ui/Icon';
import { categoryTitle } from '../shared/hooks';
import { useSwipeToDelete } from './useSwipe';

interface Props {
  transaction: Transaction;
  accountsById: Map<Id, Account>;
  categoriesById: Map<Id, Category>;
  timeZone: string;
  onOpen: (t: Transaction) => void;
  onDelete: (t: Transaction) => void;
}

export const TransactionRow = memo(function TransactionRow({
  transaction: t,
  accountsById,
  categoriesById,
  timeZone,
  onOpen,
  onDelete,
}: Props) {
  const swipe = useSwipeToDelete(() => onDelete(t));
  const account = accountsById.get(t.accountId);
  const category = t.categoryId ? categoriesById.get(t.categoryId) : undefined;
  const isTransfer = t.type === 'transfer';
  const target = t.toAccountId ? accountsById.get(t.toAccountId) : undefined;

  const title = isTransfer ? 'Перевод' : categoryTitle(category, categoriesById);
  const subtitle = isTransfer
    ? `${account?.name ?? '?'} → ${target?.name ?? '?'}`
    : [account?.name, t.note].filter(Boolean).join(' · ');
  const amountText = isTransfer
    ? formatMoney(t.amount, t.currency)
    : formatMoney(t.type === 'income' ? t.amount : -t.amount, t.currency, { sign: true });
  const amountClass = isTransfer ? 'text-muted' : t.type === 'income' ? 'text-income' : 'text-text';

  return (
    <li className="relative overflow-hidden rounded-xl">
      <div
        className="absolute inset-0 flex items-center justify-end bg-expense pr-5 text-white"
        aria-hidden="true"
      >
        <Trash2 size={22} />
      </div>
      <div
        ref={swipe.ref}
        {...swipe.handlers}
        className="relative flex touch-pan-y items-center bg-surface select-none"
      >
        <button
          type="button"
          className="flex min-h-16 flex-1 items-center gap-3 px-3 py-2 text-left"
          onClick={() => {
            if (!swipe.wasSwiped()) onOpen(t);
          }}
          aria-label={`${title}, ${amountText}${t.note ? `, ${t.note}` : ''}. Изменить`}
        >
          <IconBadge
            name={isTransfer ? 'transfer' : (category?.icon ?? 'tag')}
            color={isTransfer ? '#475569' : (category?.color ?? '#57534e')}
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{title}</span>
            <span className="block truncate text-sm text-muted">
              {subtitle || formatInTz(t.date, timeZone, 'HH:mm')}
            </span>
            {t.tags.length > 0 && (
              <span className="block truncate text-xs text-muted">
                {t.tags.map((tag) => `#${tag}`).join(' ')}
              </span>
            )}
          </span>
          <span className="flex flex-col items-end">
            <span className={`tabular font-semibold whitespace-nowrap ${amountClass}`}>
              {amountText}
            </span>
            {t.isRefund && <span className="text-xs text-muted">возврат</span>}
            {isTransfer && t.toAmount !== undefined && target && (
              <span className="tabular text-xs text-muted">
                → {formatMoney(t.toAmount, target.currency)}
              </span>
            )}
          </span>
        </button>
      </div>
    </li>
  );
});

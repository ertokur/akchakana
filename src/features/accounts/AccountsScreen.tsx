import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { totalsByCurrency } from '../../domain/balances';
import { formatMoney } from '../../domain/money';
import type { Account } from '../../domain/types';
import { ACCOUNT_KIND_LABELS } from '../../db/seed';
import { byOrder, useData } from '../../stores/dataStore';
import { Card, EmptyState, IconButton, SegmentedControl } from '../../ui/controls';
import { IconBadge } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { navigate, useRoute } from '../../app/router';
import { useBalances } from '../shared/hooks';
import { AccountForm } from './AccountForm';
import { DebtsPanel } from './DebtsPanel';

export function AccountsScreen() {
  const route = useRoute();
  const tab = route === 'debts' ? 'debts' : 'accounts';
  const [editing, setEditing] = useState<Account | 'new' | null>(null);
  const [newDebt, setNewDebt] = useState(false);

  return (
    <Screen
      title={tab === 'accounts' ? 'Счета' : 'Долги'}
      actions={
        <IconButton
          label={tab === 'accounts' ? 'Добавить счёт' : 'Добавить долг'}
          onClick={() => (tab === 'accounts' ? setEditing('new') : setNewDebt(true))}
        >
          <Plus />
        </IconButton>
      }
      header={
        <SegmentedControl
          label="Раздел"
          value={tab}
          options={[
            { value: 'accounts', label: 'Счета' },
            { value: 'debts', label: 'Долги' },
          ]}
          onChange={(v) => navigate(v)}
        />
      }
    >
      {tab === 'accounts' ? (
        <AccountsList onOpen={setEditing} />
      ) : (
        <DebtsPanel creating={newDebt} onCreatingChange={setNewDebt} />
      )}
      {editing && (
        <AccountForm
          account={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </Screen>
  );
}

function AccountsList({ onOpen }: { onOpen: (a: Account | 'new') => void }) {
  const accounts = useData((s) => s.accounts);
  const balances = useBalances();
  const sorted = useMemo(() => [...accounts].sort(byOrder), [accounts]);
  const active = sorted.filter((a) => !a.archived);
  const archived = sorted.filter((a) => a.archived);
  const totals = useMemo(() => totalsByCurrency(accounts, balances), [accounts, balances]);

  if (accounts.length === 0) {
    return (
      <EmptyState
        title="Нет счетов"
        text="Добавьте наличные, карту или накопительный счёт."
        action={
          <button
            type="button"
            className="min-h-11 rounded-xl bg-accent px-4 font-semibold text-accent-fg"
            onClick={() => onOpen('new')}
          >
            Добавить счёт
          </button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="text-sm text-muted">Всего на счетах</div>
        {[...totals].map(([currency, total]) => (
          <div
            key={currency}
            className={`tabular text-2xl font-bold ${total < 0 ? 'text-expense' : ''}`}
          >
            {formatMoney(total, currency)}
          </div>
        ))}
        {totals.size > 1 && (
          <p className="mt-1 text-xs text-muted">Суммы в разных валютах не конвертируются.</p>
        )}
      </Card>
      <AccountGroup accounts={active} balances={balances} onOpen={onOpen} />
      {archived.length > 0 && (
        <details>
          <summary className="min-h-11 cursor-pointer py-2 font-medium text-muted">
            Скрытые счета ({archived.length})
          </summary>
          <AccountGroup accounts={archived} balances={balances} onOpen={onOpen} />
        </details>
      )}
    </div>
  );
}

function AccountGroup({
  accounts,
  balances,
  onOpen,
}: {
  accounts: Account[];
  balances: Map<string, number>;
  onOpen: (a: Account) => void;
}) {
  return (
    <ul className="flex flex-col gap-px overflow-hidden rounded-xl">
      {accounts.map((a) => {
        const balance = balances.get(a.id) ?? 0;
        return (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => onOpen(a)}
              className="flex min-h-16 w-full items-center gap-3 bg-surface px-3 py-2 text-left"
            >
              <IconBadge name={a.icon} color={a.color} muted={a.archived} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{a.name}</span>
                <span className="block text-sm text-muted">
                  {ACCOUNT_KIND_LABELS[a.kind]}
                  {a.kind === 'credit' && a.creditLimit
                    ? ` · доступно ${formatMoney(a.creditLimit + balance, a.currency)}`
                    : ''}
                </span>
              </span>
              <span className={`tabular font-semibold ${balance < 0 ? 'text-expense' : ''}`}>
                {formatMoney(balance, a.currency)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

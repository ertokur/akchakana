import { useMemo, useState } from 'react';
import { ArrowLeftRight, Plus } from 'lucide-react';
import { totalsByCurrency } from '../../domain/balances';
import { formatMoney } from '../../domain/money';
import type { Account } from '../../domain/types';
import { byOrder, useData } from '../../stores/dataStore';
import { useUi } from '../../stores/uiStore';
import { Button, Card, EmptyState, IconButton, SegmentedControl } from '../../ui/controls';
import { IconBadge } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { navigate, useRoute } from '../../app/router';
import { useBalances } from '../shared/hooks';
import { AccountForm } from './AccountForm';
import { DebtsPanel } from './DebtsPanel';
import { IncomeStrip } from './IncomeStrip';
import { useT } from '../../i18n';

export function AccountsScreen() {
  const t = useT();
  const route = useRoute();
  const tab = route === 'debts' ? 'debts' : 'accounts';
  const [editing, setEditing] = useState<Account | 'new' | null>(null);
  const [newDebt, setNewDebt] = useState(false);

  return (
    <Screen
      title={tab === 'accounts' ? t('nav.accounts') : t('more.debts')}
      actions={
        <IconButton
          label={tab === 'accounts' ? t('account.add') : t('debt.add')}
          onClick={() => (tab === 'accounts' ? setEditing('new') : setNewDebt(true))}
        >
          <Plus />
        </IconButton>
      }
      header={
        <SegmentedControl
          label={t('accounts.section')}
          value={tab}
          options={[
            { value: 'accounts', label: t('nav.accounts') },
            { value: 'debts', label: t('more.debts') },
          ]}
          onChange={(v) => navigate(v)}
        />
      }
    >
      {tab === 'accounts' ? (
        <>
          <IncomeStrip />
          <AccountsList onOpen={setEditing} />
        </>
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
  const t = useT();
  const accounts = useData((s) => s.accounts);
  const balances = useBalances();
  const sorted = useMemo(() => [...accounts].sort(byOrder), [accounts]);
  const active = sorted.filter((a) => !a.archived);
  const archived = sorted.filter((a) => a.archived);
  const totals = useMemo(() => totalsByCurrency(accounts, balances), [accounts, balances]);
  const openNew = useUi((s) => s.openNew);

  if (accounts.length === 0) {
    return (
      <EmptyState
        title={t('home.noAccounts')}
        text={t('accounts.emptyText')}
        action={
          <button
            type="button"
            className="min-h-11 rounded-xl bg-accent px-4 font-semibold text-accent-fg"
            onClick={() => onOpen('new')}
          >
            {t('account.add')}
          </button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="text-sm text-muted">{t('accounts.total')}</div>
        {[...totals].map(([currency, total]) => (
          <div
            key={currency}
            className={`tabular text-2xl font-bold ${total < 0 ? 'text-expense' : ''}`}
          >
            {formatMoney(total, currency)}
          </div>
        ))}
        {totals.size > 1 && <p className="mt-1 text-xs text-muted">{t('accounts.noConversion')}</p>}
      </Card>
      {active.length > 1 && (
        <Button variant="secondary" onClick={() => openNew('transfer')}>
          <ArrowLeftRight size={18} aria-hidden="true" />
          {t('accounts.transfer')}
        </Button>
      )}
      <AccountGroup
        accounts={active}
        balances={balances}
        onOpen={onOpen}
        canTransfer={active.length > 1}
      />
      {archived.length > 0 && (
        <details>
          <summary className="min-h-11 cursor-pointer py-2 font-medium text-muted">
            {t('accounts.hidden', { count: archived.length })}
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
  canTransfer = false,
}: {
  accounts: Account[];
  balances: Map<string, number>;
  onOpen: (a: Account) => void;
  /** Показывать у счёта кнопку «Перевести с этого счёта». */
  canTransfer?: boolean;
}) {
  const t = useT();
  const openNew = useUi((s) => s.openNew);
  return (
    <ul className="flex flex-col gap-px overflow-hidden rounded-xl">
      {accounts.map((a) => {
        const balance = balances.get(a.id) ?? 0;
        return (
          <li key={a.id} className="flex items-center bg-surface">
            <button
              type="button"
              onClick={() => onOpen(a)}
              className="flex min-h-16 min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left"
            >
              <IconBadge name={a.icon} color={a.color} muted={a.archived} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{a.name}</span>
                <span className="block text-sm text-muted">
                  {t(`account.kind.${a.kind}`)}
                  {a.kind === 'credit' && a.creditLimit
                    ? ` · ${t('account.available', { amount: formatMoney(a.creditLimit + balance, a.currency) })}`
                    : ''}
                </span>
              </span>
              <span className={`tabular font-semibold ${balance < 0 ? 'text-expense' : ''}`}>
                {formatMoney(balance, a.currency)}
              </span>
            </button>
            {canTransfer && (
              <IconButton
                label={t('accounts.transferFrom', { name: a.name })}
                onClick={() => openNew('transfer', { accountId: a.id })}
                className="mr-1 text-accent"
              >
                <ArrowLeftRight size={18} aria-hidden="true" />
              </IconButton>
            )}
          </li>
        );
      })}
    </ul>
  );
}

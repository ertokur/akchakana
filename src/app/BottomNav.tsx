import { ChartPie, CircleDot, Ellipsis, ListOrdered, Wallet } from 'lucide-react';
import { navigate, PATHS, type Route } from './router';
import { useT, type DictKey } from '../i18n';

// Порядок вкладок: счета, категории, операции, обзор.
const ITEMS: { route: Route; label: DictKey; icon: typeof Wallet; match: Route[] }[] = [
  { route: 'accounts', label: 'nav.accounts', icon: Wallet, match: ['accounts', 'debts'] },
  { route: 'home', label: 'nav.categories', icon: CircleDot, match: ['home'] },
  { route: 'transactions', label: 'nav.transactions', icon: ListOrdered, match: ['transactions'] },
  { route: 'stats', label: 'nav.stats', icon: ChartPie, match: ['stats'] },
  {
    route: 'more',
    label: 'nav.more',
    icon: Ellipsis,
    match: [
      'more',
      'budgets',
      'categories',
      'recurring',
      'settings',
      'import',
      'export',
      'changelog',
    ],
  },
];

export function BottomNav({ current }: { current: Route }) {
  const t = useT();
  return (
    <nav
      aria-label={t('nav.main')}
      className="pb-safe pl-safe pr-safe fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur"
    >
      <ul className="mx-auto flex max-w-lg">
        {ITEMS.map(({ route, label, icon: Icon, match }) => {
          const active = match.includes(current);
          return (
            <li key={route} className="flex-1">
              <a
                href={`#${PATHS[route]}`}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(route);
                }}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium ${active ? 'text-accent' : 'text-muted'}`}
              >
                <Icon size={22} strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
                {t(label)}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

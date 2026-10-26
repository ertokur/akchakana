import { ChartPie, Ellipsis, ListOrdered, Target, Wallet } from 'lucide-react';
import { navigate, type Route } from './router';

const ITEMS: { route: Route; label: string; icon: typeof Wallet; match: Route[] }[] = [
  { route: 'transactions', label: 'Операции', icon: ListOrdered, match: ['transactions'] },
  { route: 'accounts', label: 'Счета', icon: Wallet, match: ['accounts', 'debts'] },
  { route: 'stats', label: 'Обзор', icon: ChartPie, match: ['stats'] },
  { route: 'budgets', label: 'Бюджеты', icon: Target, match: ['budgets'] },
  {
    route: 'more',
    label: 'Ещё',
    icon: Ellipsis,
    match: ['more', 'categories', 'recurring', 'settings', 'import', 'export'],
  },
];

export function BottomNav({ current }: { current: Route }) {
  return (
    <nav
      aria-label="Основная навигация"
      className="pb-safe pl-safe pr-safe fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur"
    >
      <ul className="mx-auto flex max-w-lg">
        {ITEMS.map(({ route, label, icon: Icon, match }) => {
          const active = match.includes(current);
          return (
            <li key={route} className="flex-1">
              <a
                href={`#${route === 'transactions' ? '/' : `/${route}`}`}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(route);
                }}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium ${active ? 'text-accent' : 'text-muted'}`}
              >
                <Icon size={22} strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
                {label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

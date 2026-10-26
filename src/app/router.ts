import { useSyncExternalStore } from 'react';

/** Минимальный hash-роутер: `#/accounts`, `#/settings/import` и т. п. Работает офлайн без настройки сервера. */
export type Route =
  | 'transactions'
  | 'accounts'
  | 'stats'
  | 'budgets'
  | 'more'
  | 'categories'
  | 'recurring'
  | 'debts'
  | 'settings'
  | 'import'
  | 'export';

const ROUTES: Record<string, Route> = {
  '': 'transactions',
  '/': 'transactions',
  '/accounts': 'accounts',
  '/stats': 'stats',
  '/budgets': 'budgets',
  '/more': 'more',
  '/categories': 'categories',
  '/recurring': 'recurring',
  '/debts': 'debts',
  '/settings': 'settings',
  '/settings/import': 'import',
  '/settings/export': 'export',
};

export const PATHS: Record<Route, string> = {
  transactions: '/',
  accounts: '/accounts',
  stats: '/stats',
  budgets: '/budgets',
  more: '/more',
  categories: '/categories',
  recurring: '/recurring',
  debts: '/debts',
  settings: '/settings',
  import: '/settings/import',
  export: '/settings/export',
};

export function parseRoute(hash: string): Route {
  return ROUTES[hash.replace(/^#/, '').replace(/\/$/, '') || '/'] ?? 'transactions';
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, () => parseRoute(window.location.hash));
}

export function navigate(route: Route): void {
  window.location.hash = PATHS[route];
}

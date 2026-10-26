import { lazy, type ComponentType } from 'react';
import type { Route } from './router';
import { Screen } from '../ui/Screen';
import { EmptyState } from '../ui/controls';
import { AccountsScreen } from '../features/accounts/AccountsScreen';
import { CategoriesScreen } from '../features/categories/CategoriesScreen';
import { MoreScreen } from '../features/more/MoreScreen';

// Тяжёлые экраны (Chart.js, sql.js) грузятся отдельными чанками по требованию.
const StatsScreen = lazy(() =>
  import('../features/stats/StatsScreen').then((m) => ({ default: m.StatsScreen })),
);

function Placeholder() {
  return (
    <Screen title="Скоро">
      <EmptyState title="Раздел в разработке" />
    </Screen>
  );
}

/** Экраны по маршрутам (кроме «Операций»). */
export const SCREENS: Partial<Record<Route, ComponentType>> = {
  accounts: AccountsScreen,
  debts: AccountsScreen,
  stats: StatsScreen,
  budgets: Placeholder,
  more: MoreScreen,
  categories: CategoriesScreen,
  recurring: Placeholder,
  settings: Placeholder,
  import: Placeholder,
  export: Placeholder,
};

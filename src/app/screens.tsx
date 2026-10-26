import type { ComponentType } from 'react';
import type { Route } from './router';
import { Screen } from '../ui/Screen';
import { EmptyState } from '../ui/controls';
import { AccountsScreen } from '../features/accounts/AccountsScreen';
import { CategoriesScreen } from '../features/categories/CategoriesScreen';
import { MoreScreen } from '../features/more/MoreScreen';

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
  stats: Placeholder,
  budgets: Placeholder,
  more: MoreScreen,
  categories: CategoriesScreen,
  recurring: Placeholder,
  settings: Placeholder,
  import: Placeholder,
  export: Placeholder,
};

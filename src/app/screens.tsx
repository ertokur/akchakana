import type { ComponentType } from 'react';
import type { Route } from './router';
import { Screen } from '../ui/Screen';
import { EmptyState } from '../ui/controls';

function Placeholder() {
  return (
    <Screen title="Скоро">
      <EmptyState title="Раздел в разработке" />
    </Screen>
  );
}

/** Экраны по маршрутам (кроме «Операций»). */
export const SCREENS: Partial<Record<Route, ComponentType>> = {
  accounts: Placeholder,
  stats: Placeholder,
  budgets: Placeholder,
  more: Placeholder,
  categories: Placeholder,
  recurring: Placeholder,
  debts: Placeholder,
  settings: Placeholder,
  import: Placeholder,
  export: Placeholder,
};

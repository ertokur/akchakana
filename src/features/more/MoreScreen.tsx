import {
  ChevronRight,
  Download,
  HandCoins,
  Repeat,
  Settings,
  Shapes,
  Target,
  Upload,
} from 'lucide-react';
import { navigate, type Route } from '../../app/router';
import { MadeWith } from '../../ui/MadeWith';
import { Screen } from '../../ui/Screen';
import { useT, type DictKey } from '../../i18n';

const ITEMS: { route: Route; label: DictKey; hint: DictKey; icon: typeof Shapes }[] = [
  { route: 'budgets', label: 'more.budgets', hint: 'more.budgetsHint', icon: Target },
  { route: 'categories', label: 'nav.categories', hint: 'more.categoriesHint', icon: Shapes },
  { route: 'recurring', label: 'more.recurring', hint: 'more.recurringHint', icon: Repeat },
  { route: 'debts', label: 'more.debts', hint: 'more.debtsHint', icon: HandCoins },
  { route: 'import', label: 'more.import', hint: 'more.importHint', icon: Upload },
  { route: 'export', label: 'more.export', hint: 'more.exportHint', icon: Download },
  { route: 'settings', label: 'more.settings', hint: 'more.settingsHint', icon: Settings },
];

export function MoreScreen() {
  const t = useT();
  return (
    <Screen title={t('nav.more')}>
      {/* Колонка на всю высоту экрана, чтобы подпись стояла в самом низу. */}
      <div className="flex min-h-[calc(100dvh-11rem)] flex-col">
        <ul className="flex flex-col gap-px overflow-hidden rounded-xl">
          {ITEMS.map(({ route, label, hint, icon: Icon }) => (
            <li key={route}>
              <button
                type="button"
                onClick={() => navigate(route)}
                className="flex min-h-16 w-full items-center gap-3 bg-surface px-4 py-2 text-left"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{t(label)}</span>
                  <span className="block truncate text-sm text-muted">{t(hint)}</span>
                </span>
                <ChevronRight size={20} className="text-muted" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        <MadeWith />
      </div>
    </Screen>
  );
}

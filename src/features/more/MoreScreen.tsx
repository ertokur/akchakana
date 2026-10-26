import { ChevronRight, Download, HandCoins, Repeat, Settings, Shapes, Upload } from 'lucide-react';
import { navigate, type Route } from '../../app/router';
import { Screen } from '../../ui/Screen';

const ITEMS: { route: Route; label: string; hint: string; icon: typeof Shapes }[] = [
  { route: 'categories', label: 'Категории', hint: 'Порядок, подкатегории, скрытие', icon: Shapes },
  { route: 'recurring', label: 'Регулярные платежи', hint: 'Подписки и напоминания', icon: Repeat },
  { route: 'debts', label: 'Долги', hint: 'Мне должны и я должен', icon: HandCoins },
  { route: 'import', label: 'Импорт', hint: 'Резервная копия 1Money или CSV', icon: Upload },
  { route: 'export', label: 'Экспорт', hint: 'Сохранить все данные в CSV', icon: Download },
  { route: 'settings', label: 'Настройки', hint: 'Валюта, тема, PIN-код', icon: Settings },
];

export function MoreScreen() {
  return (
    <Screen title="Ещё">
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
                <span className="block font-medium">{label}</span>
                <span className="block truncate text-sm text-muted">{hint}</span>
              </span>
              <ChevronRight size={20} className="text-muted" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </Screen>
  );
}

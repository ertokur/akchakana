import { Suspense, useEffect, type ReactNode } from 'react';
import { useData } from '../stores/dataStore';
import { TransactionsScreen } from '../features/transactions/TransactionsScreen';
import { TransactionSheet } from '../features/editor/TransactionSheet';
import { OnboardingScreen } from '../features/onboarding/OnboardingScreen';
import { Toasts } from '../ui/Toasts';
import { BottomNav } from './BottomNav';
import { useRoute, type Route } from './router';
import { useTheme } from './useTheme';
import { SCREENS } from './screens';

export function App() {
  const loaded = useData((s) => s.loaded);
  const load = useData((s) => s.load);
  const settings = useData((s) => s.settings);
  const route = useRoute();
  useTheme(settings.theme);

  useEffect(() => {
    void load();
  }, [load]);

  if (!loaded) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted" role="status">
        Загрузка…
      </div>
    );
  }

  // Онбординг, пока не создан первый счёт; импорт доступен прямо из него.
  if (!settings.onboarded && route !== 'import') {
    return (
      <>
        <OnboardingScreen />
        <Toasts />
      </>
    );
  }

  return (
    <>
      <Suspense
        fallback={
          <div className="flex min-h-dvh items-center justify-center text-muted" role="status">
            Загрузка…
          </div>
        }
      >
        {renderRoute(route)}
      </Suspense>
      {settings.onboarded && <BottomNav current={route} />}
      <TransactionSheet />
      <Toasts />
    </>
  );
}

function renderRoute(route: Route): ReactNode {
  if (route === 'transactions') return <TransactionsScreen />;
  const Screen = SCREENS[route];
  return Screen ? <Screen /> : <TransactionsScreen />;
}

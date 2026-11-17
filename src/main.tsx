import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/cyrillic-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/cyrillic-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/cyrillic-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/inter/cyrillic-700.css';
import './styles/index.css';
import { App } from './app/App';
import { useUi } from './stores/uiStore';
import { t } from './i18n';

// Service worker: офлайн-работа и обновление по согласию пользователя.
const updateSW = registerSW({
  onNeedRefresh() {
    useUi.getState().toast({
      text: t('pwa.updateAvailable'),
      duration: 60_000,
      action: { label: t('pwa.update'), run: () => void updateSW(true) },
    });
  },
  onOfflineReady() {
    useUi.getState().toast({ text: t('pwa.offlineReady') });
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

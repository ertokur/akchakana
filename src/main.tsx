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

// Service worker: офлайн-работа и обновление по согласию пользователя.
const updateSW = registerSW({
  onNeedRefresh() {
    useUi.getState().toast({
      text: 'Доступна новая версия',
      duration: 60_000,
      action: { label: 'Обновить', run: () => void updateSW(true) },
    });
  },
  onOfflineReady() {
    useUi.getState().toast({ text: 'Приложение готово к работе без интернета' });
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { setLanguage } from '../src/i18n';

// Системный пояс теста намеренно отличается от пояса приложения (Asia/Bishkek).
process.env.TZ = 'America/New_York';

// Тесты ищут элементы по русским текстам: «система» в тестах — на русском.
if (typeof navigator !== 'undefined') {
  Object.defineProperty(navigator, 'language', { value: 'ru-RU', configurable: true });
  Object.defineProperty(navigator, 'languages', { value: ['ru-RU', 'ru'], configurable: true });
}
// Модули тестов могут создавать данные при импорте, поэтому язык ставим сразу и перед каждым тестом.
setLanguage('ru');
beforeEach(() => setLanguage('ru'));

afterEach(() => cleanup());

if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

// jsdom не рисует canvas: графики в тестах не создаются, но разметка проверяется.
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = (() =>
    null) as typeof HTMLCanvasElement.prototype.getContext;
}

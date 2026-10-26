import { useEffect } from 'react';
import type { ThemeSetting } from '../domain/types';

const THEME_COLORS = { light: '#f3f5f4', dark: '#0c1110' };

/** Применяет тему к <html> и обновляет цвет системной панели (meta theme-color). */
export function useTheme(theme: ThemeSetting): void {
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && !!media?.matches);
      document.documentElement.classList.toggle('dark', dark);
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', dark ? THEME_COLORS.dark : THEME_COLORS.light);
    };
    apply();
    if (theme !== 'system' || !media) return;
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
}

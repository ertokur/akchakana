import { useCallback } from 'react';
import { create } from 'zustand';
import { enUS, ru as ruLocale } from 'date-fns/locale';
import type { Locale } from 'date-fns';
import { ru, type Dict, type DictKey, type Plural } from './ru';
import { en } from './en';

/** Язык интерфейса. */
export type Lang = 'en' | 'ru';
/** Настройка языка: `system` — по языку системы (русский, если система на русском, иначе английский). */
export type LanguageSetting = 'system' | Lang;
export type { DictKey };

export const LANGUAGES: Lang[] = ['en', 'ru'];
/** Названия языков всегда на самом языке, чтобы их можно было найти в любом интерфейсе. */
export const LANGUAGE_NAMES: Record<Lang, string> = { en: 'English', ru: 'Русский' };

const DICTS: Record<Lang, Dict> = { ru, en };

/** Язык системы: русский, если первый предпочитаемый язык браузера русский, иначе английский. */
export function systemLanguage(): Lang {
  if (typeof navigator === 'undefined') return 'en';
  const preferred = navigator.languages?.[0] ?? navigator.language ?? '';
  return preferred.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

export function resolveLanguage(setting: LanguageSetting | undefined): Lang {
  return setting === 'en' || setting === 'ru' ? setting : systemLanguage();
}

export const useLang = create<{ lang: Lang }>(() => ({ lang: systemLanguage() }));

function applyDocumentLang(lang: Lang): void {
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
}
applyDocumentLang(useLang.getState().lang);

export function setLanguage(lang: Lang): void {
  applyDocumentLang(lang);
  if (useLang.getState().lang !== lang) useLang.setState({ lang });
}

/** Применяет настройку языка (вызывается при загрузке и изменении настроек). */
export function applyLanguageSetting(setting: LanguageSetting | undefined): void {
  setLanguage(resolveLanguage(setting));
}

export function getLang(): Lang {
  return useLang.getState().lang;
}

/** Локаль для Intl и date-fns. */
export function intlLocale(lang: Lang = getLang()): string {
  return lang === 'ru' ? 'ru-RU' : 'en-US';
}

export function dateLocale(lang: Lang = getLang()): Locale {
  return lang === 'ru' ? ruLocale : enUS;
}

export type Params = Record<string, string | number>;

const pluralRules = new Map<Lang, Intl.PluralRules>();

function pickPlural(lang: Lang, forms: Plural, count: number): string {
  let rules = pluralRules.get(lang);
  if (!rules) {
    rules = new Intl.PluralRules(lang);
    pluralRules.set(lang, rules);
  }
  const cat = rules.select(count) as keyof Plural;
  return forms[cat] ?? forms.other ?? forms.few ?? forms.many ?? forms.one;
}

/**
 * Перевод ключа на язык `lang`. Параметры подставляются вместо `{name}`;
 * для строк с формами множественного числа число берётся из `params.count`.
 */
export function translate(lang: Lang, key: DictKey, params?: Params): string {
  const entry = DICTS[lang][key] ?? ru[key];
  const text =
    typeof entry === 'string' ? entry : pickPlural(lang, entry, Number(params?.count ?? 0));
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, name: string) =>
    name in params ? String(params[name]) : m,
  );
}

/** Перевод на текущий язык (для кода вне компонентов). */
export function t(key: DictKey, params?: Params): string {
  return translate(getLang(), key, params);
}

export type TFunction = (key: DictKey, params?: Params) => string;

/** Хук перевода: компонент перерисуется при смене языка. */
export function useT(): TFunction {
  const lang = useLang((s) => s.lang);
  return useCallback((key, params) => translate(lang, key, params), [lang]);
}

export function useLanguage(): Lang {
  return useLang((s) => s.lang);
}

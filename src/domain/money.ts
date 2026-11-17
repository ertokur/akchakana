import type { CurrencyCode, Minor } from './types';
import { getLang, t, type Lang } from '../i18n';

const digitsCache = new Map<string, number>();

/** Количество знаков после запятой у валюты (KGS, USD — 2; JPY — 0). */
export function fractionDigits(currency: CurrencyCode): number {
  const cached = digitsCache.get(currency);
  if (cached !== undefined) return cached;
  let digits: number;
  try {
    digits =
      new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
        .maximumFractionDigits ?? 2;
  } catch {
    digits = 2;
  }
  digitsCache.set(currency, digits);
  return digits;
}

const SPACES = /[\s\u00a0\u202f']/g;
const MINUSES = /[−–—]/g;

/**
 * Парсит десятичную строку в минимальные единицы без использования float.
 * Принимает «2864.5», «-76,75», «1 234,56», «1,234.56», «+10».
 * Бросает RangeError при неверном формате или лишних значащих знаках дроби.
 */
export function parseMinor(input: string, digits = 2): Minor {
  let s = input.trim().replace(SPACES, '').replace(MINUSES, '-');
  let negative = false;
  if (s.startsWith('-')) {
    negative = true;
    s = s.slice(1);
  } else if (s.startsWith('+')) {
    s = s.slice(1);
  }
  if (s === '') throw new RangeError(t('money.invalid', { input }));
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  let intPart = s;
  let fracPart = '';
  if (lastDot >= 0 || lastComma >= 0) {
    const sepIndex = Math.max(lastDot, lastComma);
    const sep = s[sepIndex];
    const other = sep === '.' ? ',' : '.';
    const sameSepCount = s.split(sep).length - 1;
    if (s.includes(other) || sameSepCount === 1) {
      intPart = s.slice(0, sepIndex).split(other).join('');
      fracPart = s.slice(sepIndex + 1);
    } else {
      // Несколько одинаковых разделителей — это разделители тысяч: «1.234.567».
      intPart = s.split(sep).join('');
    }
  }
  if (intPart === '') intPart = '0';
  if (!/^\d+$/.test(intPart) || !/^\d*$/.test(fracPart)) {
    throw new RangeError(t('money.invalid', { input }));
  }
  if (fracPart.length > digits) {
    const extra = fracPart.slice(digits);
    if (/[^0]/.test(extra)) throw new RangeError(t('money.tooManyDigits', { input }));
    fracPart = fracPart.slice(0, digits);
  }
  const value = Number(intPart + fracPart.padEnd(digits, '0'));
  if (!Number.isSafeInteger(value)) throw new RangeError(t('money.tooLarge', { input }));
  return negative && value !== 0 ? -value : value;
}

export function tryParseMinor(input: string, digits = 2): Minor | null {
  try {
    return parseMinor(input, digits);
  } catch {
    return null;
  }
}

/** Десятичная строка без разделителей тысяч: 286450 → «2864.50» (или с запятой). */
export function toDecimalString(minor: Minor, digits = 2, decimalSep = '.'): string {
  const negative = minor < 0;
  const abs = String(Math.abs(minor)).padStart(digits + 1, '0');
  const int = abs.slice(0, abs.length - digits);
  const frac = abs.slice(abs.length - digits);
  return (negative ? '-' : '') + int + (digits > 0 ? decimalSep + frac : '');
}

/** Разделители чисел по языку: «1 234,56» по-русски, «1,234.56» по-английски. */
export function numberSeparators(lang: Lang = getLang()): { group: string; decimal: string } {
  return lang === 'ru' ? { group: '\u00a0', decimal: ',' } : { group: ',', decimal: '.' };
}

/** Форматирует для показа: 123456 → «1 234,56» (ru) или «1,234.56» (en). Без float. */
export function formatMinor(
  minor: Minor,
  digits = 2,
  opts: { group?: string; decimal?: string; trimZeros?: boolean } = {},
): string {
  const defaults = numberSeparators();
  const group = opts.group ?? defaults.group;
  const decimal = opts.decimal ?? defaults.decimal;
  const trimZeros = opts.trimZeros ?? false;
  const negative = minor < 0;
  const plain = toDecimalString(Math.abs(minor), digits, '.');
  const [rawInt, rawFrac = ''] = plain.split('.');
  const int = rawInt.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  const frac = trimZeros && /^0*$/.test(rawFrac) ? '' : rawFrac;
  return (negative ? '−' : '') + int + (frac ? decimal + frac : '');
}

const symbolCache = new Map<string, string>();

export function currencySymbol(currency: CurrencyCode, lang: Lang = getLang()): string {
  const cacheKey = `${lang}:${currency}`;
  const cached = symbolCache.get(cacheKey);
  if (cached) return cached;
  let symbol: string;
  if (currency === 'KGS' && lang === 'ru') symbol = 'сом';
  else {
    try {
      const parts = new Intl.NumberFormat(lang, {
        style: 'currency',
        currency,
        // По-английски — обычный символ: $ и € есть, у редких валют (KGS, KZT) — код.
        currencyDisplay: lang === 'en' ? 'symbol' : 'narrowSymbol',
      }).formatToParts(0);
      symbol = parts.find((p) => p.type === 'currency')?.value ?? currency;
    } catch {
      symbol = currency;
    }
  }
  symbolCache.set(cacheKey, symbol);
  return symbol;
}

export function formatMoney(
  minor: Minor,
  currency: CurrencyCode,
  opts: { sign?: boolean; trimZeros?: boolean } = {},
): string {
  const digits = fractionDigits(currency);
  const lang = getLang();
  const symbol = currencySymbol(currency, lang);
  const sign = minor < 0 ? '−' : opts.sign && minor > 0 ? '+' : '';
  const body = formatMinor(Math.abs(minor), digits, { trimZeros: opts.trimZeros ?? true });
  // По-английски знак валюты пишется перед суммой ($1,234.56), буквенный код — после (1,234.56 KGS).
  if (lang === 'en' && !/^[A-Za-z]+$/.test(symbol)) return `${sign}${symbol}${body}`;
  return `${sign}${body}\u00a0${symbol}`;
}

export const COMMON_CURRENCIES: CurrencyCode[] = [
  'KGS',
  'KZT',
  'RUB',
  'UZS',
  'USD',
  'EUR',
  'CNY',
  'TRY',
  'GBP',
  'AED',
  'JPY',
];

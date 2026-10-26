import type { Minor } from './types';

/**
 * Калькулятор для ввода суммы. Значения хранятся как BigInt в минимальных единицах,
 * поэтому ошибок float нет. Умножение и деление трактуют правый операнд как число,
 * результат округляется банковским способом (к чётному).
 */
export type CalcOp = '+' | '-' | '*' | '/';
export const CALC_OPS: readonly string[] = ['+', '-', '*', '/'];

const isOp = (t: string | undefined): t is CalcOp => t !== undefined && CALC_OPS.includes(t);

function toScaled(token: string, digits: number): bigint {
  const negative = token.startsWith('-');
  const [int, frac = ''] = token.replace('-', '').replace(',', '.').split('.');
  const f = (frac + '0'.repeat(digits)).slice(0, digits);
  const value = BigInt((int || '0') + f);
  return negative ? -value : value;
}

function divRoundHalfEven(a: bigint, b: bigint): bigint {
  if (b === 0n) throw new RangeError('Деление на ноль');
  const negative = a < 0n !== b < 0n;
  const absA = a < 0n ? -a : a;
  const absB = b < 0n ? -b : b;
  let q = absA / absB;
  const twice = (absA % absB) * 2n;
  if (twice > absB || (twice === absB && q % 2n === 1n)) q += 1n;
  return negative ? -q : q;
}

/** Разбивает выражение «120+30*2» на числа и операции. */
export function tokenize(expr: string): string[] {
  const normalized = expr
    .replace(/\s/g, '')
    .replace(/[×x]/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-');
  const tokens: string[] = [];
  let num = '';
  for (const ch of normalized) {
    if (isOp(ch)) {
      if (num === '' && ch === '-' && tokens.length === 0) {
        num = '-';
        continue;
      }
      if (num !== '' && num !== '-') tokens.push(num);
      num = '';
      tokens.push(ch);
    } else if (/[\d.,]/.test(ch)) {
      num += ch;
    } else {
      throw new RangeError(`Недопустимый символ «${ch}»`);
    }
  }
  if (num !== '' && num !== '-') tokens.push(num);
  return tokens;
}

/** Вычисляет выражение и возвращает результат в минимальных единицах. Висящая операция в конце игнорируется. */
export function evaluate(expr: string, digits = 2): Minor {
  const tokens = tokenize(expr);
  while (tokens.length && isOp(tokens[tokens.length - 1])) tokens.pop();
  if (tokens.length === 0) return 0;
  const scale = 10n ** BigInt(digits);
  let i = 0;
  const readNumber = (): bigint => {
    const t = tokens[i++];
    if (t === undefined || isOp(t)) throw new RangeError('Ожидалось число');
    return toScaled(t, digits);
  };
  // Сначала * и /, затем + и -.
  const terms: bigint[] = [];
  const signs: CalcOp[] = [];
  let current = readNumber();
  while (i < tokens.length) {
    const op = tokens[i++] as CalcOp;
    const rhs = readNumber();
    if (op === '*') current = divRoundHalfEven(current * rhs, scale);
    else if (op === '/') current = divRoundHalfEven(current * scale, rhs);
    else {
      terms.push(current);
      signs.push(op);
      current = rhs;
    }
  }
  terms.push(current);
  let result = terms[0];
  signs.forEach((sign, k) => {
    result = sign === '+' ? result + terms[k + 1] : result - terms[k + 1];
  });
  const n = Number(result);
  if (!Number.isSafeInteger(n)) throw new RangeError('Слишком большая сумма');
  return n;
}

/** Есть ли в выражении операция (не считая минуса в начале). */
export function hasOperator(expr: string): boolean {
  return tokenize(expr).some(isOp);
}

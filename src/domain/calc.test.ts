import { evaluate, hasOperator, tokenize } from './calc';

describe('калькулятор', () => {
  it.each([
    ['', 0],
    ['120', 12000],
    ['120.5', 12050],
    ['120,5', 12050],
    ['100+50', 15000],
    ['100-150', -5000],
    ['100+20*3', 16000],
    ['100/3', 3333],
    ['200/3', 6667],
    ['0.1+0.2', 30],
    ['10×2÷4', 500],
    ['100+', 10000],
    ['-5+10', 500],
    ['0.05*0.5', 2], // 2.5 тыйына → к чётному = 2
    ['0.15*0.5', 8], // 7.5 → 8
  ])('%s = %i', (expr, expected) => {
    expect(evaluate(expr, 2)).toBe(expected);
  });

  it('деление на ноль — ошибка', () => {
    expect(() => evaluate('10/0')).toThrow(RangeError);
  });

  it('разбивает выражение', () => {
    expect(tokenize('12+3,5*2')).toEqual(['12', '+', '3,5', '*', '2']);
    expect(hasOperator('12')).toBe(false);
    expect(hasOperator('-12')).toBe(false);
    expect(hasOperator('12-1')).toBe(true);
  });
});

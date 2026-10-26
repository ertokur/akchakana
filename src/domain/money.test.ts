import {
  formatMinor,
  formatMoney,
  fractionDigits,
  parseMinor,
  toDecimalString,
  tryParseMinor,
} from './money';

describe('parseMinor', () => {
  it.each([
    ['76.75', 7675],
    ['2864.5', 286450],
    ['2864', 286400],
    ['-76,75', -7675],
    ['−76,75', -7675],
    ['1 234,56', 123456],
    ['1\u00a0234,56', 123456],
    ['1,234.56', 123456],
    ['1.234,56', 123456],
    ['1.234.567', 123456700],
    ['+10', 1000],
    ['0.1', 10],
    ['.5', 50],
    ['0', 0],
    ['-0', 0],
    ['1.230', 123],
    ['0.07', 7],
  ])('%s → %i', (input, expected) => {
    expect(parseMinor(input, 2)).toBe(expected);
  });

  it('учитывает число знаков валюты', () => {
    expect(parseMinor('1500', 0)).toBe(1500);
    expect(parseMinor('1.5', 3)).toBe(1500);
  });

  it('не теряет точность там, где float ошибается', () => {
    // 0.1 + 0.2 во float = 0.30000000000000004; строковый парсинг точен.
    expect(parseMinor('0.29', 2)).toBe(29);
    expect(parseMinor('1.15', 2)).toBe(115);
    expect(parseMinor('4.35', 2)).toBe(435);
    expect(parseMinor('90071992547409.91', 2)).toBe(9007199254740991);
  });

  it.each(['', 'abc', '1.2.3,4,5', '12a', '1.234', '-', '1e5'])('отвергает «%s»', (input) => {
    if (input === '1.234') {
      expect(() => parseMinor(input, 2)).toThrow(RangeError);
    } else {
      expect(tryParseMinor(input, 2)).toBeNull();
    }
  });

  it('отвергает слишком большие суммы', () => {
    expect(() => parseMinor('900719925474099.99', 2)).toThrow(RangeError);
  });
});

describe('форматирование', () => {
  it('toDecimalString', () => {
    expect(toDecimalString(286450, 2)).toBe('2864.50');
    expect(toDecimalString(-7, 2)).toBe('-0.07');
    expect(toDecimalString(-7675, 2, ',')).toBe('-76,75');
    expect(toDecimalString(1500, 0)).toBe('1500');
    expect(toDecimalString(0, 2)).toBe('0.00');
  });

  it('formatMinor группирует тысячи', () => {
    expect(formatMinor(123456789, 2)).toBe('1\u00a0234\u00a0567,89');
    expect(formatMinor(-100000, 2, { trimZeros: true })).toBe('−1\u00a0000');
    expect(formatMinor(5, 2)).toBe('0,05');
  });

  it('formatMoney', () => {
    expect(formatMoney(150000, 'KGS')).toBe('1\u00a0500\u00a0сом');
    expect(formatMoney(150050, 'KGS', { sign: true })).toBe('+1\u00a0500,50\u00a0сом');
    expect(fractionDigits('JPY')).toBe(0);
    expect(fractionDigits('KGS')).toBe(2);
    expect(fractionDigits('XXX-invalid')).toBe(2);
  });
});

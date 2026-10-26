import { Check, Delete } from 'lucide-react';
import { useEffect } from 'react';

type Key = string;

const ROWS: { key: Key; label: string; aria?: string; kind?: 'op' | 'action' }[][] = [
  [
    { key: '/', label: '÷', aria: 'Разделить', kind: 'op' },
    { key: '*', label: '×', aria: 'Умножить', kind: 'op' },
    { key: '-', label: '−', aria: 'Минус', kind: 'op' },
    { key: '+', label: '+', aria: 'Плюс', kind: 'op' },
  ],
  [
    { key: '7', label: '7' },
    { key: '8', label: '8' },
    { key: '9', label: '9' },
    { key: 'back', label: '', aria: 'Стереть', kind: 'action' },
  ],
  [
    { key: '4', label: '4' },
    { key: '5', label: '5' },
    { key: '6', label: '6' },
    { key: '=', label: '=', aria: 'Вычислить', kind: 'op' },
  ],
  [
    { key: '1', label: '1' },
    { key: '2', label: '2' },
    { key: '3', label: '3' },
    { key: 'clear', label: 'C', aria: 'Очистить', kind: 'action' },
  ],
  [
    { key: '.', label: ',', aria: 'Запятая' },
    { key: '0', label: '0' },
    { key: '00', label: '00' },
  ],
];

const OPS = ['+', '-', '*', '/'];

/** Применяет нажатие к строке выражения. Не допускает двух операций подряд и двух запятых в числе. */
export function applyKey(expr: string, key: Key, digits: number): string {
  if (key === 'clear') return '';
  if (key === 'back') return expr.slice(0, -1);
  const last = expr.slice(-1);
  if (OPS.includes(key)) {
    if (expr === '' || expr === '-') return key === '-' ? '-' : expr;
    if (OPS.includes(last)) return expr.slice(0, -1) + key;
    return expr + key;
  }
  const currentNumber = expr.split(/[+\-*/]/).pop() ?? '';
  if (key === '.') {
    if (digits === 0 || currentNumber.includes('.')) return expr;
    return expr + (currentNumber === '' ? '0.' : '.');
  }
  // Цифры: ограничиваем дробную часть числом знаков валюты.
  const frac = currentNumber.split('.')[1];
  if (frac !== undefined && frac.length + key.length > digits) return expr;
  if (currentNumber === '0' && !currentNumber.includes('.')) {
    return expr.slice(0, -1) + (key === '00' ? '0' : key);
  }
  if (key === '00' && currentNumber === '') return expr + '0';
  if (currentNumber.replace('.', '').length >= 13) return expr;
  return expr + key;
}

export function CalcKeypad({
  onKey,
  onSubmit,
  submitLabel,
  submitDisabled,
}: {
  onKey: (key: Key) => void;
  onSubmit: () => void;
  submitLabel: string;
  submitDisabled?: boolean;
}) {
  // Физическая клавиатура (десктоп): цифры, операции, Backspace, Enter.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, select')) return;
      if (/^[0-9]$/.test(e.key)) onKey(e.key);
      else if (e.key === ',' || e.key === '.') onKey('.');
      else if (OPS.includes(e.key)) onKey(e.key);
      else if (e.key === 'Backspace') onKey('back');
      else if (e.key === 'Enter' && !target.closest('button')) onSubmit();
      else return;
      e.preventDefault();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onKey, onSubmit]);

  return (
    <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Калькулятор">
      {ROWS.flat().map((k) => (
        <button
          key={k.key}
          type="button"
          aria-label={k.aria ?? k.label}
          onClick={() => onKey(k.key)}
          className={`tabular flex min-h-11 items-center justify-center rounded-xl text-xl font-medium active:brightness-90 ${k.kind === 'op' ? 'bg-accent-soft text-accent-strong' : k.kind === 'action' ? 'bg-surface-2 text-muted' : 'bg-surface-2 text-text'}`}
        >
          {k.key === 'back' ? <Delete size={22} /> : k.label}
        </button>
      ))}
      <button
        type="button"
        onClick={onSubmit}
        disabled={submitDisabled}
        aria-label={submitLabel}
        className="flex min-h-11 items-center justify-center rounded-xl bg-accent text-accent-fg disabled:opacity-50"
      >
        <Check size={26} strokeWidth={2.6} aria-hidden="true" />
      </button>
    </div>
  );
}

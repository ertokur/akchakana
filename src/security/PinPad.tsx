import { Delete } from 'lucide-react';

/** Экранная цифровая клавиатура для PIN-кода. */
export function PinPad({
  value,
  onChange,
  onSubmit,
  maxLength = 6,
  submitLabel = 'Готово',
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  maxLength?: number;
  submitLabel?: string;
}) {
  const press = (d: string) => value.length < maxLength && onChange(value + d);
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex gap-3" aria-label={`Введено цифр: ${value.length}`} role="status">
        {Array.from({ length: Math.max(4, value.length) }, (_, i) => (
          <span
            key={i}
            className={`h-3.5 w-3.5 rounded-full border-2 border-accent ${i < value.length ? 'bg-accent' : ''}`}
          />
        ))}
      </div>
      <div className="grid w-full max-w-xs grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => press(d)}
            className="tabular min-h-16 rounded-2xl bg-surface-2 text-2xl font-medium active:brightness-90"
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          aria-label="Стереть"
          onClick={() => onChange(value.slice(0, -1))}
          className="flex min-h-16 items-center justify-center rounded-2xl text-muted"
        >
          <Delete size={26} />
        </button>
        <button
          type="button"
          onClick={() => press('0')}
          className="tabular min-h-16 rounded-2xl bg-surface-2 text-2xl font-medium active:brightness-90"
        >
          0
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={value.length < 4}
          className="min-h-16 rounded-2xl bg-accent font-semibold text-accent-fg disabled:opacity-40"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

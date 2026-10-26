import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { dayKey, periodLabel, shiftPeriod, type PeriodKind } from '../../domain/dates';
import { BottomSheet } from '../../ui/BottomSheet';
import { Button, Field, IconButton, SegmentedControl, TextInput } from '../../ui/controls';
import { useUi } from '../../stores/uiStore';
import { usePeriod, usePeriodOptions } from '../shared/hooks';

const KINDS: { value: PeriodKind; label: string }[] = [
  { value: 'day', label: 'День' },
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'year', label: 'Год' },
  { value: 'custom', label: 'Период' },
];

export function PeriodSwitcher() {
  const selection = useUi((s) => s.period);
  const setPeriod = useUi((s) => s.setPeriod);
  const period = usePeriod();
  const opts = usePeriodOptions();
  const [customOpen, setCustomOpen] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const shift = (delta: number) => {
    const next = shiftPeriod(period, delta, opts);
    if (next.kind === 'custom') {
      setPeriod({
        kind: 'custom',
        anchor: next.start,
        from: dayKey(next.start, opts.timeZone),
        to: dayKey(next.end - 1, opts.timeZone),
      });
    } else {
      setPeriod({ kind: next.kind, anchor: next.start + 1 });
    }
  };

  const openCustom = () => {
    setFrom(selection.from ?? dayKey(period.start, opts.timeZone));
    setTo(selection.to ?? dayKey(period.end - 1, opts.timeZone));
    setCustomOpen(true);
  };

  return (
    <div className="flex flex-col gap-2">
      <SegmentedControl
        label="Период"
        size="sm"
        value={selection.kind}
        options={KINDS}
        onChange={(kind) => {
          if (kind === 'custom') openCustom();
          else setPeriod({ kind, anchor: Math.min(Date.now(), period.end - 1) });
        }}
      />
      <div className="flex items-center justify-between">
        <IconButton label="Предыдущий период" onClick={() => shift(-1)}>
          <ChevronLeft />
        </IconButton>
        <button
          type="button"
          className="min-h-11 flex-1 rounded-lg font-semibold first-letter:uppercase"
          onClick={() =>
            selection.kind === 'custom'
              ? openCustom()
              : setPeriod({ kind: selection.kind, anchor: Date.now() })
          }
          aria-label={`Текущий период: ${periodLabel(period, opts.timeZone)}. Вернуться к сегодняшнему`}
        >
          <span className="inline-block first-letter:uppercase">
            {periodLabel(period, opts.timeZone)}
          </span>
        </button>
        <IconButton label="Следующий период" onClick={() => shift(1)}>
          <ChevronRight />
        </IconButton>
      </div>
      <BottomSheet
        open={customOpen}
        onClose={() => setCustomOpen(false)}
        title="Произвольный период"
      >
        <div className="flex flex-col gap-3">
          <Field label="С">
            {(id) => (
              <TextInput
                id={id}
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            )}
          </Field>
          <Field label="По">
            {(id) => (
              <TextInput id={id} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            )}
          </Field>
          <Button
            block
            disabled={!from || !to}
            onClick={() => {
              const [a, b] = from <= to ? [from, to] : [to, from];
              setPeriod({ kind: 'custom', anchor: Date.now(), from: a, to: b });
              setCustomOpen(false);
            }}
          >
            Показать
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
}

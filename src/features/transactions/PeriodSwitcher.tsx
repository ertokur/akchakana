import { useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { dayKey, periodLabel, shiftPeriod, type PeriodKind } from '../../domain/dates';
import { BottomSheet } from '../../ui/BottomSheet';
import { Button, Field, IconButton, TextInput } from '../../ui/controls';
import { useUi } from '../../stores/uiStore';
import { usePeriod, usePeriodOptions } from '../shared/hooks';
import { useT, type DictKey } from '../../i18n';

const KINDS: { value: Exclude<PeriodKind, 'custom'>; label: DictKey }[] = [
  { value: 'day', label: 'period.day' },
  { value: 'week', label: 'period.week' },
  { value: 'month', label: 'period.month' },
  { value: 'year', label: 'period.year' },
];

/**
 * Компактный переключатель периода, как в 1Money: стрелки листают период,
 * нажатие на подпись открывает выбор (день, неделя, месяц, год или свои даты).
 */
export function PeriodSwitcher() {
  const selection = useUi((s) => s.period);
  const setPeriod = useUi((s) => s.setPeriod);
  const period = usePeriod();
  const opts = usePeriodOptions();
  const t = useT();
  const [open, setOpen] = useState(false);
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

  const openPicker = () => {
    setFrom(selection.from ?? dayKey(period.start, opts.timeZone));
    setTo(selection.to ?? dayKey(period.end - 1, opts.timeZone));
    setOpen(true);
  };

  const label = periodLabel(period, opts.timeZone);

  return (
    <div className="flex items-center justify-between">
      <IconButton label={t('period.previous')} onClick={() => shift(-1)}>
        <ChevronLeft />
      </IconButton>
      <button
        type="button"
        className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg font-semibold"
        onClick={openPicker}
        aria-label={t('period.aria', { label })}
      >
        <CalendarDays size={18} className="text-accent" aria-hidden="true" />
        <span className="first-letter:uppercase">{label}</span>
      </button>
      <IconButton label={t('period.next')} onClick={() => shift(1)}>
        <ChevronRight />
      </IconButton>
      <BottomSheet open={open} onClose={() => setOpen(false)} title={t('period.title')}>
        <div className="flex flex-col gap-4">
          <div role="radiogroup" aria-label={t('period.length')} className="grid grid-cols-2 gap-2">
            {KINDS.map((k) => (
              <button
                key={k.value}
                type="button"
                role="radio"
                aria-checked={selection.kind === k.value}
                onClick={() => {
                  setPeriod({ kind: k.value, anchor: Math.min(Date.now(), period.end - 1) });
                  setOpen(false);
                }}
                className={`min-h-12 rounded-xl font-medium ${selection.kind === k.value ? 'bg-accent text-accent-fg' : 'bg-surface-2'}`}
              >
                {t(k.label)}
              </button>
            ))}
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              setPeriod({
                kind: selection.kind === 'custom' ? 'month' : selection.kind,
                anchor: Date.now(),
              });
              setOpen(false);
            }}
          >
            {t('common.today')}
          </Button>
          <div className="flex flex-col gap-3 rounded-2xl border border-border p-3">
            <span className="font-medium">{t('period.custom')}</span>
            <div className="grid grid-cols-2 gap-2">
              <Field label={t('period.from')}>
                {(id) => (
                  <TextInput
                    id={id}
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                )}
              </Field>
              <Field label={t('period.to')}>
                {(id) => (
                  <TextInput
                    id={id}
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                  />
                )}
              </Field>
            </div>
            <Button
              disabled={!from || !to}
              onClick={() => {
                const [a, b] = from <= to ? [from, to] : [to, from];
                setPeriod({ kind: 'custom', anchor: Date.now(), from: a, to: b });
                setOpen(false);
              }}
            >
              {t('period.show')}
            </Button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

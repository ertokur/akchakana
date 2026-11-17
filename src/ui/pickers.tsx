import { Check } from 'lucide-react';
import { PALETTE } from '../db/seed';
import { Icon, ICON_KEYS } from './Icon';
import { useT } from '../i18n';

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const t = useT();
  return (
    <div role="radiogroup" aria-label={t('picker.color')} className="grid grid-cols-7 gap-2">
      {PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={c === value}
          aria-label={t('picker.colorValue', { value: c })}
          onClick={() => onChange(c)}
          className="flex h-11 w-11 items-center justify-center rounded-full text-white"
          style={{ background: c }}
        >
          {c === value && <Check size={20} aria-hidden="true" />}
        </button>
      ))}
    </div>
  );
}

export function IconPicker({
  value,
  color,
  onChange,
}: {
  value: string;
  color: string;
  onChange: (icon: string) => void;
}) {
  const t = useT();
  return (
    <div role="radiogroup" aria-label={t('picker.icon')} className="grid grid-cols-6 gap-2">
      {ICON_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={key === value}
          aria-label={t('picker.iconValue', { value: key })}
          onClick={() => onChange(key)}
          className={`flex h-11 w-11 items-center justify-center rounded-full ${key === value ? 'text-white' : 'bg-surface-2 text-text'}`}
          style={key === value ? { background: color } : undefined}
        >
          <Icon name={key} size={20} />
        </button>
      ))}
    </div>
  );
}

import { Icon } from '../../ui/Icon';
import { useT } from '../../i18n';

/**
 * Половина заголовка шторки операции, как в 1Money: «Со счёта» / «В категорию».
 * Залита цветом счёта или категории; нажатие открывает выбор.
 */
export function FlowEndpoint({
  caption,
  name,
  detail,
  color,
  icon,
  onClick,
  align = 'left',
}: {
  caption: string;
  name?: string;
  detail?: string;
  color?: string;
  icon?: string;
  onClick: () => void;
  align?: 'left' | 'right';
}) {
  const t = useT();
  const filled = !!name && !!color;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t('editor.endpointAria', { caption, name: name ?? t('common.notSelected') })}
      className={`flex min-h-20 min-w-0 flex-1 flex-col gap-1 rounded-2xl px-3 py-2 ${align === 'right' ? 'items-end text-right' : 'items-start text-left'} ${filled ? 'text-white' : 'border-2 border-dashed border-border text-muted'}`}
      style={filled ? { background: color } : undefined}
    >
      <span
        className={`flex items-center gap-1.5 text-xs ${align === 'right' ? 'flex-row-reverse' : ''} ${filled ? 'text-white/90' : ''}`}
      >
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${filled ? 'bg-white/20' : 'bg-surface-2'}`}
        >
          <Icon name={icon ?? 'dots'} size={16} />
        </span>
        {caption}
      </span>
      <span className="line-clamp-2 w-full leading-tight font-semibold break-words">
        {name ?? t('common.choose')}
      </span>
      {detail && (
        <span className={`tabular block w-full truncate text-xs ${filled ? 'text-white/90' : ''}`}>
          {detail}
        </span>
      )}
    </button>
  );
}

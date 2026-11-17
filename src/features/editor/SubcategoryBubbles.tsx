import { Check } from 'lucide-react';
import type { Category, Id } from '../../domain/types';
import { Icon } from '../../ui/Icon';
import { useT } from '../../i18n';

/**
 * Выбор подкатегории в шторке операции, как в 1Money: горизонтальная строка круглых значков.
 * Первый значок — сама категория (без подкатегории), за ним её подкатегории.
 */
export function SubcategoryBubbles({
  parent,
  subcategories,
  value,
  onChange,
}: {
  parent: Category;
  subcategories: Category[];
  value?: Id;
  onChange: (id: Id) => void;
}) {
  const t = useT();
  const options = [parent, ...subcategories];
  return (
    <div
      role="radiogroup"
      aria-label={t('editor.subcategory')}
      className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 [scrollbar-width:none]"
    >
      {options.map((c) => {
        const checked = c.id === value;
        const isParent = c.id === parent.id;
        return (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={isParent ? t('editor.parentItself', { name: c.name }) : c.name}
            onClick={() => onChange(c.id)}
            className="flex w-[4.25rem] shrink-0 flex-col items-center gap-1 rounded-xl py-1 active:scale-95"
            style={{ transition: 'transform 120ms ease-out' }}
          >
            <span className="relative flex h-14 w-14 items-center justify-center">
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-full text-white transition-opacity ${checked ? '' : 'opacity-45'}`}
                style={{ background: c.color }}
              >
                <Icon name={c.icon} size={22} />
              </span>
              {checked && (
                <>
                  <span
                    className="pointer-events-none absolute inset-0 rounded-full border-2"
                    style={{ borderColor: c.color }}
                    aria-hidden="true"
                  />
                  <span
                    className="absolute right-0 bottom-0 flex h-5 w-5 items-center justify-center rounded-full border-2 border-surface bg-accent text-accent-fg"
                    aria-hidden="true"
                  >
                    <Check size={12} strokeWidth={3} />
                  </span>
                </>
              )}
            </span>
            <span
              className={`line-clamp-2 w-full text-center text-xs leading-tight ${checked ? 'font-semibold text-text' : 'text-muted'}`}
            >
              {c.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}

import { useMemo } from 'react';
import type { Category, CategoryKind, Id } from '../../domain/types';
import { byOrder } from '../../stores/dataStore';
import { IconBadge } from '../../ui/Icon';
import { useT } from '../../i18n';

/**
 * Сетка категорий верхнего уровня, как в 1Money. Подкатегории выбираются уже в шторке
 * операции строкой значков (`SubcategoryBubbles`).
 */
export function CategoryGrid({
  categories,
  kind,
  value,
  onChange,
}: {
  categories: Category[];
  kind: CategoryKind;
  value?: Id;
  onChange: (id: Id) => void;
}) {
  const t = useT();
  const parents = useMemo(() => {
    const active = categories.filter((c) => c.kind === kind && (!c.archived || c.id === value));
    const ids = new Set(active.map((c) => c.id));
    return active.filter((c) => !c.parentId || !ids.has(c.parentId)).sort(byOrder);
  }, [categories, kind, value]);

  const selected = categories.find((c) => c.id === value);
  const selectedParentId = selected?.parentId ?? selected?.id;

  if (parents.length === 0) {
    return <p className="py-4 text-center text-muted">{t('editor.noCategories')}</p>;
  }

  return (
    <div role="radiogroup" aria-label={t('common.category')} className="grid grid-cols-4 gap-1">
      {parents.map((c) => {
        const checked = c.id === selectedParentId;
        return (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => onChange(c.id)}
            className={`flex min-h-20 flex-col items-center justify-start gap-1 rounded-xl px-1 py-2 text-center ${checked ? 'bg-accent-soft ring-2 ring-accent' : ''}`}
          >
            <IconBadge name={c.icon} color={c.color} size={40} />
            <span className="line-clamp-2 text-xs leading-tight">{c.name}</span>
          </button>
        );
      })}
    </div>
  );
}

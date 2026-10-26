import { useMemo } from 'react';
import type { Category, CategoryKind, Id } from '../../domain/types';
import { byOrder } from '../../stores/dataStore';
import { IconBadge } from '../../ui/Icon';

/** Сетка категорий; у выбранной категории с подкатегориями ниже показываются её подкатегории. */
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
  const { parents, childrenOf } = useMemo(() => {
    const active = categories.filter((c) => c.kind === kind && (!c.archived || c.id === value));
    const childrenOf = new Map<Id, Category[]>();
    for (const c of active) {
      if (c.parentId) childrenOf.set(c.parentId, [...(childrenOf.get(c.parentId) ?? []), c]);
    }
    for (const list of childrenOf.values()) list.sort(byOrder);
    const ids = new Set(active.map((c) => c.id));
    const parents = active.filter((c) => !c.parentId || !ids.has(c.parentId)).sort(byOrder);
    return { parents, childrenOf };
  }, [categories, kind, value]);

  const selected = categories.find((c) => c.id === value);
  const selectedParentId = selected?.parentId ?? selected?.id;
  const subs = selectedParentId ? (childrenOf.get(selectedParentId) ?? []) : [];

  if (parents.length === 0) {
    return (
      <p className="py-4 text-center text-muted">
        Нет категорий. Добавьте их в разделе «Категории».
      </p>
    );
  }

  return (
    <div>
      <div role="radiogroup" aria-label="Категория" className="grid grid-cols-4 gap-1">
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
      {subs.length > 0 && selectedParentId && (
        <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Подкатегория">
          {[{ id: selectedParentId, name: 'Без подкатегории' }, ...subs].map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={value === s.id}
              onClick={() => onChange(s.id)}
              className={`min-h-11 rounded-full border px-3 text-sm ${value === s.id ? 'border-accent bg-accent-soft font-semibold' : 'border-border'}`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

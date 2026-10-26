import { useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical, Plus } from 'lucide-react';
import { categoryTree, moveCategory, siblingsOf } from '../../domain/categories';
import type { Category, CategoryKind } from '../../domain/types';
import { useData } from '../../stores/dataStore';
import { EmptyState, IconButton, SegmentedControl } from '../../ui/controls';
import { IconBadge } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { navigate } from '../../app/router';
import { CategoryForm } from './CategoryForm';

export function CategoriesScreen() {
  const categories = useData((s) => s.categories);
  const saveCategories = useData((s) => s.saveCategories);
  const [kind, setKind] = useState<CategoryKind>('expense');
  const [editing, setEditing] = useState<Category | 'new' | null>(null);

  const tree = useMemo(() => categoryTree(categories, kind), [categories, kind]);
  const active = tree.filter((n) => !n.parent.archived);
  const archived = tree.filter((n) => n.parent.archived);

  const move = (c: Category, toIndex: number) => {
    const changed = moveCategory(categories, c.id, toIndex);
    if (changed.length) void saveCategories(changed);
  };

  return (
    <Screen
      title="Категории"
      onBack={() => navigate('more')}
      actions={
        <IconButton label="Добавить категорию" onClick={() => setEditing('new')}>
          <Plus />
        </IconButton>
      }
      header={
        <SegmentedControl
          label="Тип категорий"
          value={kind}
          options={[
            { value: 'expense', label: 'Расходы' },
            { value: 'income', label: 'Доходы' },
          ]}
          onChange={setKind}
        />
      }
    >
      {tree.length === 0 ? (
        <EmptyState title="Нет категорий" text="Добавьте первую категорию кнопкой «+»." />
      ) : (
        <div className="flex flex-col gap-4">
          <SortableList
            items={active.map((n) => n.parent)}
            onMove={move}
            onOpen={setEditing}
            renderChildren={(parent) => {
              const children = active.find((n) => n.parent.id === parent.id)?.children ?? [];
              return children.length ? (
                <SortableList items={children} onMove={move} onOpen={setEditing} nested />
              ) : null;
            }}
          />
          {archived.length > 0 && (
            <details>
              <summary className="min-h-11 cursor-pointer py-2 font-medium text-muted">
                Скрытые ({archived.length})
              </summary>
              <ul className="flex flex-col gap-px overflow-hidden rounded-xl">
                {archived.map(({ parent }) => (
                  <li key={parent.id}>
                    <CategoryButton category={parent} onOpen={setEditing} />
                  </li>
                ))}
              </ul>
            </details>
          )}
          <p className="text-center text-sm text-muted">
            Порядок меняется перетаскиванием за ручку или кнопками со стрелками.
          </p>
        </div>
      )}
      {editing && (
        <CategoryForm
          category={editing === 'new' ? undefined : editing}
          kind={kind}
          onClose={() => setEditing(null)}
          siblingsCount={siblingsOf(categories, kind, undefined).length}
        />
      )}
    </Screen>
  );
}

function CategoryButton({
  category,
  onOpen,
}: {
  category: Category;
  onOpen: (c: Category) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(category)}
      className="flex min-h-14 min-w-0 flex-1 items-center gap-3 bg-surface px-3 py-2 text-left"
    >
      <IconBadge name={category.icon} color={category.color} size={36} muted={category.archived} />
      <span className="truncate font-medium">{category.name}</span>
    </button>
  );
}

/**
 * Список с перетаскиванием за ручку (pointer events) и кнопками «вверх/вниз» для доступности.
 * Во время перетаскивания порядок меняется локально, сохраняется при отпускании.
 */
function SortableList({
  items,
  onMove,
  onOpen,
  renderChildren,
  nested = false,
}: {
  items: Category[];
  onMove: (c: Category, toIndex: number) => void;
  onOpen: (c: Category) => void;
  renderChildren?: (c: Category) => React.ReactNode;
  nested?: boolean;
}) {
  const [preview, setPreview] = useState<Category[] | null>(null);
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const dragging = useRef<Category | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const list = preview ?? items;

  const onPointerDown = (e: React.PointerEvent, c: Category) => {
    dragging.current = c;
    setDraggingId(c.id);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setPreview(items);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const c = dragging.current;
    if (!c || !preview) return;
    const over = preview.find((item) => {
      const rect = rowRefs.current.get(item.id)?.getBoundingClientRect();
      return rect && e.clientY >= rect.top && e.clientY <= rect.bottom;
    });
    if (!over || over.id === c.id) return;
    const next = preview.filter((i) => i.id !== c.id);
    next.splice(
      preview.findIndex((i) => i.id === over.id),
      0,
      c,
    );
    setPreview(next);
  };
  const onPointerUp = () => {
    const c = dragging.current;
    dragging.current = null;
    setDraggingId(null);
    if (c && preview) {
      const toIndex = preview.findIndex((i) => i.id === c.id);
      onMove(c, toIndex);
    }
    setPreview(null);
  };

  return (
    <ul className={`flex flex-col gap-px overflow-hidden rounded-xl ${nested ? 'ml-8' : ''}`}>
      {list.map((c, index) => (
        <li
          key={c.id}
          ref={(el) => {
            if (el) rowRefs.current.set(c.id, el);
            else rowRefs.current.delete(c.id);
          }}
        >
          <div
            className={`flex items-center bg-surface ${draggingId === c.id ? 'opacity-70' : ''}`}
          >
            <span
              className="flex h-11 w-9 shrink-0 cursor-grab touch-none items-center justify-center text-muted"
              onPointerDown={(e) => onPointerDown(e, c)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              aria-hidden="true"
            >
              <GripVertical size={18} />
            </span>
            <CategoryButton category={c} onOpen={onOpen} />
            <IconButton
              label={`Поднять «${c.name}»`}
              disabled={index === 0}
              onClick={() => onMove(c, index - 1)}
            >
              <ArrowUp size={18} />
            </IconButton>
            <IconButton
              label={`Опустить «${c.name}»`}
              disabled={index === list.length - 1}
              onClick={() => onMove(c, index + 1)}
            >
              <ArrowDown size={18} />
            </IconButton>
          </div>
          {renderChildren?.(c)}
        </li>
      ))}
    </ul>
  );
}

import type { Category, CategoryKind, Id } from './types';

const byOrder = (a: Category, b: Category) =>
  a.order - b.order || a.name.localeCompare(b.name, 'ru');

/** Соседи категории: категории того же типа с тем же родителем, по порядку. */
export function siblingsOf(
  categories: Category[],
  kind: CategoryKind,
  parentId: Id | undefined,
): Category[] {
  return categories
    .filter((c) => c.kind === kind && (c.parentId ?? undefined) === parentId)
    .sort(byOrder);
}

/**
 * Перемещает категорию на позицию `toIndex` среди соседей.
 * Возвращает только изменившиеся категории с перенумерованным order (0, 1, 2…).
 */
export function moveCategory(
  categories: Category[],
  id: Id,
  toIndex: number,
  now = Date.now(),
): Category[] {
  const target = categories.find((c) => c.id === id);
  if (!target) return [];
  const siblings = siblingsOf(categories, target.kind, target.parentId);
  const from = siblings.findIndex((c) => c.id === id);
  const to = Math.max(0, Math.min(siblings.length - 1, toIndex));
  if (from === to) return [];
  const reordered = [...siblings];
  reordered.splice(from, 1);
  reordered.splice(to, 0, target);
  return reordered
    .map((c, order) => (c.order === order ? null : { ...c, order, updatedAt: now }))
    .filter((c): c is Category => c !== null);
}

/** Дерево для отображения: родители по порядку, у каждого — дети по порядку. */
export function categoryTree(
  categories: Category[],
  kind: CategoryKind,
): { parent: Category; children: Category[] }[] {
  const ofKind = categories.filter((c) => c.kind === kind);
  const ids = new Set(ofKind.map((c) => c.id));
  return ofKind
    .filter((c) => !c.parentId || !ids.has(c.parentId))
    .sort(byOrder)
    .map((parent) => ({
      parent,
      children: ofKind.filter((c) => c.parentId === parent.id).sort(byOrder),
    }));
}

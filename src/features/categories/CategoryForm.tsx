import { useState } from 'react';
import { PALETTE } from '../../db/seed';
import { siblingsOf } from '../../domain/categories';
import { newId } from '../../domain/ids';
import type { Category, CategoryKind } from '../../domain/types';
import { getRepositories } from '../../repositories';
import { byOrder, useData } from '../../stores/dataStore';
import { useUi } from '../../stores/uiStore';
import { BottomSheet, ConfirmDialog } from '../../ui/BottomSheet';
import { Button, Field, Select, TextInput, Toggle } from '../../ui/controls';
import { DEFAULT_ICON } from '../../ui/Icon';
import { ColorPicker, IconPicker } from '../../ui/pickers';

export function CategoryForm({
  category,
  kind: initialKind,
  onClose,
  siblingsCount,
}: {
  category?: Category;
  kind: CategoryKind;
  onClose: () => void;
  siblingsCount: number;
}) {
  const categories = useData((s) => s.categories);
  const saveCategory = useData((s) => s.saveCategory);
  const saveCategories = useData((s) => s.saveCategories);
  const deleteCategory = useData((s) => s.deleteCategory);
  const toast = useUi((s) => s.toast);
  const kind = category?.kind ?? initialKind;

  const [name, setName] = useState(category?.name ?? '');
  const [parentId, setParentId] = useState(category?.parentId ?? '');
  const [color, setColor] = useState(category?.color ?? PALETTE[siblingsCount % PALETTE.length]);
  const [icon, setIcon] = useState(category?.icon ?? DEFAULT_ICON);
  const [archived, setArchived] = useState(category?.archived ?? false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  const hasChildren = category ? categories.some((c) => c.parentId === category.id) : false;
  const parentOptions = categories
    .filter((c) => c.kind === kind && !c.parentId && c.id !== category?.id && !c.archived)
    .sort(byOrder);

  const save = async () => {
    if (!name.trim()) return setError('Введите название');
    const now = Date.now();
    const parent = parentId || undefined;
    const parentChanged = (category?.parentId ?? undefined) !== parent;
    const next: Category = {
      id: category?.id ?? newId(),
      name: name.trim(),
      kind,
      parentId: parent,
      color,
      icon,
      archived,
      order:
        category && !parentChanged ? category.order : siblingsOf(categories, kind, parent).length,
      createdAt: category?.createdAt ?? now,
      updatedAt: now,
      source: category?.source,
    };
    await saveCategory(next);
    // Скрытие родителя скрывает и подкатегории.
    if (category && archived !== category.archived && hasChildren) {
      await saveCategories(
        categories
          .filter((c) => c.parentId === category.id)
          .map((c) => ({ ...c, archived, updatedAt: now })),
      );
    }
    toast({ text: category ? 'Категория сохранена' : 'Категория добавлена' });
    onClose();
  };

  const remove = async () => {
    if (!category) return;
    setConfirm(false);
    if (hasChildren) return setError('Сначала удалите или перенесите подкатегории.');
    const refs = await getRepositories().transactions.countReferences(category.id);
    const budgetRefs = useData.getState().budgets.some((b) => b.categoryId === category.id);
    if (refs > 0 || budgetRefs) {
      return setError(
        `Категория используется${refs ? ` в ${refs} операциях` : ''}${budgetRefs ? ' в бюджете' : ''}. Скройте её вместо удаления.`,
      );
    }
    await deleteCategory(category.id);
    toast({ text: 'Категория удалена' });
    onClose();
  };

  return (
    <BottomSheet
      open
      tall
      onClose={onClose}
      title={
        category
          ? 'Категория'
          : kind === 'expense'
            ? 'Новая категория расходов'
            : 'Новая категория доходов'
      }
      footer={
        <div className="flex gap-2">
          {category && (
            <Button variant="danger" onClick={() => setConfirm(true)}>
              Удалить
            </Button>
          )}
          <Button block onClick={save}>
            Сохранить
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Название">
          {(id) => (
            <TextInput
              id={id}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus={!category}
            />
          )}
        </Field>
        <Field
          label="Родительская категория"
          hint={
            hasChildren
              ? 'У категории есть подкатегории, поэтому она остаётся верхнего уровня'
              : undefined
          }
        >
          {(id) => (
            <Select
              id={id}
              value={parentId}
              disabled={hasChildren}
              onChange={(e) => setParentId(e.target.value)}
            >
              <option value="">— Нет (верхний уровень) —</option>
              {parentOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-muted">Цвет</span>
          <ColorPicker value={color} onChange={setColor} />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-muted">Иконка</span>
          <IconPicker value={icon} color={color} onChange={setIcon} />
        </div>
        {category && (
          <Toggle
            checked={archived}
            onChange={setArchived}
            label="Скрыть категорию"
            description="Скрытая категория остаётся в старых операциях, но не предлагается в новых"
          />
        )}
        {error && (
          <p role="alert" className="text-sm font-medium text-expense">
            {error}
          </p>
        )}
      </div>
      <ConfirmDialog
        open={confirm}
        title="Удалить категорию?"
        text="Удалить можно только неиспользуемую категорию."
        onCancel={() => setConfirm(false)}
        onConfirm={remove}
      />
    </BottomSheet>
  );
}

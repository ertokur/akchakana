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
import { SubcategoryEditor } from './SubcategoryEditor';
import { useT } from '../../i18n';

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
  const t = useT();
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
    if (!name.trim()) return setError(t('form.enterName'));
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
    toast({ text: category ? t('category.saved') : t('category.added') });
    onClose();
  };

  const remove = async () => {
    if (!category) return;
    setConfirm(false);
    if (hasChildren) return setError(t('category.hasChildren'));
    const refs = await getRepositories().transactions.countReferences(category.id);
    const budgetRefs = useData.getState().budgets.some((b) => b.categoryId === category.id);
    if (refs > 0 || budgetRefs) {
      const where = [
        refs ? t('category.inTransactions', { count: refs }) : '',
        budgetRefs ? t('category.inBudget') : '',
      ]
        .filter(Boolean)
        .join(t('category.whereJoin'));
      return setError(t('category.inUse', { where }));
    }
    await deleteCategory(category.id);
    toast({ text: t('category.deleted') });
    onClose();
  };

  return (
    <BottomSheet
      open
      tall
      onClose={onClose}
      title={
        category
          ? t('common.category')
          : kind === 'expense'
            ? t('home.newExpenseCategory')
            : t('home.newIncomeCategory')
      }
      footer={
        <div className="flex gap-2">
          {category && (
            <Button variant="danger" onClick={() => setConfirm(true)}>
              {t('common.delete')}
            </Button>
          )}
          <Button block onClick={save}>
            {t('common.save')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label={t('common.name')}>
          {(id) => (
            <TextInput
              id={id}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus={!category}
            />
          )}
        </Field>
        {category && !category.parentId && <SubcategoryEditor parent={category} />}
        <Field
          label={t('category.parent')}
          hint={hasChildren ? t('category.parentLocked') : undefined}
        >
          {(id) => (
            <Select
              id={id}
              value={parentId}
              disabled={hasChildren}
              onChange={(e) => setParentId(e.target.value)}
            >
              <option value="">{t('category.noParent')}</option>
              {parentOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-muted">{t('common.color')}</span>
          <ColorPicker value={color} onChange={setColor} />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-muted">{t('common.icon')}</span>
          <IconPicker value={icon} color={color} onChange={setIcon} />
        </div>
        {category && (
          <Toggle
            checked={archived}
            onChange={setArchived}
            label={t('category.hide')}
            description={t('category.hideHint')}
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
        title={t('category.deleteConfirm')}
        text={t('category.deleteHint')}
        onCancel={() => setConfirm(false)}
        onConfirm={remove}
      />
    </BottomSheet>
  );
}

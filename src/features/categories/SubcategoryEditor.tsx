import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { moveCategory } from '../../domain/categories';
import { newId } from '../../domain/ids';
import type { Category } from '../../domain/types';
import { getRepositories } from '../../repositories';
import { byOrder, useData } from '../../stores/dataStore';
import { useUi } from '../../stores/uiStore';
import { IconButton, TextInput } from '../../ui/controls';
import { IconBadge } from '../../ui/Icon';
import { useT } from '../../i18n';

/** Метка времени для изменений (вызывается только из обработчиков событий). */
const timestamp = () => Date.now();

/** Список подкатегорий внутри карточки категории: добавление, переименование, порядок, удаление. */
export function SubcategoryEditor({ parent }: { parent: Category }) {
  const t = useT();
  const categories = useData((s) => s.categories);
  const saveCategory = useData((s) => s.saveCategory);
  const saveCategories = useData((s) => s.saveCategories);
  const deleteCategory = useData((s) => s.deleteCategory);
  const toast = useUi((s) => s.toast);
  const children = categories.filter((c) => c.parentId === parent.id).sort(byOrder);
  const active = children.filter((c) => !c.archived);
  const [newName, setNewName] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const add = async () => {
    const name = newName.trim();
    if (!name) return;
    const now = timestamp();
    await saveCategory({
      id: newId(),
      name,
      kind: parent.kind,
      parentId: parent.id,
      color: parent.color,
      icon: parent.icon,
      archived: false,
      order: children.length,
      createdAt: now,
      updatedAt: now,
    });
    setNewName('');
  };

  const rename = async (c: Category) => {
    const name = drafts[c.id]?.trim();
    if (!name || name === c.name) return;
    await saveCategory({ ...c, name, updatedAt: timestamp() });
  };

  const remove = async (c: Category) => {
    const refs = await getRepositories().transactions.countReferences(c.id);
    const inBudget = useData.getState().budgets.some((b) => b.categoryId === c.id);
    if (refs > 0 || inBudget) {
      // Используемую подкатегорию скрываем, чтобы не потерять историю.
      await saveCategory({ ...c, archived: true, updatedAt: timestamp() });
      toast({ text: t('subcategory.hiddenInUse', { name: c.name }) });
      return;
    }
    await deleteCategory(c.id);
    toast({
      text: t('subcategory.deleted', { name: c.name }),
      action: { label: t('common.undo'), run: () => void saveCategory(c) },
    });
  };

  const restore = (c: Category) => saveCategory({ ...c, archived: false, updatedAt: timestamp() });

  return (
    <section aria-label={t('subcategory.title')} className="flex flex-col gap-2">
      <span className="text-sm font-medium text-muted">{t('subcategory.title')}</span>
      {active.length === 0 && <p className="text-sm text-muted">{t('subcategory.empty')}</p>}
      <ul className="flex flex-col gap-1">
        {active.map((c, index) => (
          <li key={c.id} className="flex items-center gap-1 rounded-xl bg-surface-2 pl-2">
            <IconBadge name={c.icon} color={c.color} size={28} />
            <TextInput
              aria-label={t('subcategory.nameAria', { name: c.name })}
              className="border-transparent bg-transparent"
              value={drafts[c.id] ?? c.name}
              onChange={(e) => setDrafts({ ...drafts, [c.id]: e.target.value })}
              onBlur={() => void rename(c)}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            />
            <IconButton
              label={t('category.moveUp', { name: c.name })}
              disabled={index === 0}
              onClick={() => void saveCategories(moveCategory(categories, c.id, index - 1))}
            >
              <ArrowUp size={18} />
            </IconButton>
            <IconButton
              label={t('category.moveDown', { name: c.name })}
              disabled={index === active.length - 1}
              onClick={() => void saveCategories(moveCategory(categories, c.id, index + 1))}
            >
              <ArrowDown size={18} />
            </IconButton>
            <IconButton
              label={t('subcategory.deleteAria', { name: c.name })}
              onClick={() => void remove(c)}
            >
              <Trash2 size={18} className="text-expense" />
            </IconButton>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <TextInput
          aria-label={t('subcategory.new')}
          placeholder={t('subcategory.new')}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void add()}
        />
        <IconButton
          label={t('subcategory.add')}
          className="bg-accent text-accent-fg hover:bg-accent-strong"
          onClick={() => void add()}
        >
          <Plus size={22} />
        </IconButton>
      </div>
      {children.some((c) => c.archived) && (
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-muted">{t('subcategory.hidden')}</span>
          {children
            .filter((c) => c.archived)
            .map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => void restore(c)}
                className="min-h-11 rounded-full border border-border px-3 text-sm text-muted"
                aria-label={t('subcategory.restore', { name: c.name })}
              >
                {c.name} ↺
              </button>
            ))}
        </div>
      )}
    </section>
  );
}

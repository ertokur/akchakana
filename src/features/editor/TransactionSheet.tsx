import { useCallback, useMemo, useState } from 'react';
import { ArrowRight, Trash2 } from 'lucide-react';
import { evaluate, hasOperator } from '../../domain/calc';
import { fromDateTimeInput, toDateTimeInput } from '../../domain/dates';
import { newId } from '../../domain/ids';
import {
  formatMinor,
  formatMoney,
  fractionDigits,
  numberSeparators,
  toDecimalString,
  tryParseMinor,
} from '../../domain/money';
import type { Transaction, TransactionType } from '../../domain/types';
import { byOrder, useData } from '../../stores/dataStore';
import { useUi, type EditorState } from '../../stores/uiStore';
import { BottomSheet, ConfirmDialog } from '../../ui/BottomSheet';
import { IconButton, SegmentedControl, TextInput } from '../../ui/controls';
import { checkBudgetsAfterSave } from '../budgets/warnings';
import { AccountPickerSheet } from './AccountPicker';
import { FlowEndpoint } from './FlowEndpoint';
import { SubcategoryBubbles } from './SubcategoryBubbles';
import { useBalances } from '../shared/hooks';
import { applyKey, CalcKeypad } from './CalcKeypad';
import { CategoryGrid } from './CategoryGrid';
import { useT, type DictKey } from '../../i18n';

const TYPES: { value: TransactionType; label: DictKey }[] = [
  { value: 'expense', label: 'common.expense' },
  { value: 'income', label: 'common.income' },
  { value: 'transfer', label: 'common.transfer' },
];

export function TransactionSheet() {
  const editor = useUi((s) => s.editor);
  const close = useUi((s) => s.closeEditor);
  if (editor.mode === 'closed') return null;
  const key = editor.mode === 'edit' ? editor.transaction.id : `new-${editor.type}`;
  return <EditorForm key={key} editor={editor} onClose={close} />;
}

function lastUsedAccount(transactions: Transaction[]): string | undefined {
  let best: Transaction | undefined;
  for (const t of transactions) if (!best || t.createdAt > best.createdAt) best = t;
  return best?.accountId;
}

function EditorForm({
  editor,
  onClose,
}: {
  editor: Exclude<EditorState, { mode: 'closed' }>;
  onClose: () => void;
}) {
  const accounts = useData((s) => s.accounts);
  const categories = useData((s) => s.categories);
  const transactions = useData((s) => s.transactions);
  const settings = useData((s) => s.settings);
  const saveTransaction = useData((s) => s.saveTransaction);
  const deleteTransaction = useData((s) => s.deleteTransaction);
  const toast = useUi((s) => s.toast);
  const tr = useT();

  const original = editor.mode === 'edit' ? editor.transaction : undefined;
  const preset = editor.mode === 'new' ? editor.preset : undefined;
  const sortedAccounts = useMemo(() => [...accounts].sort(byOrder), [accounts]);
  const defaultAccount =
    original?.accountId ??
    preset?.accountId ??
    [lastUsedAccount(transactions), sortedAccounts.find((a) => !a.archived)?.id].find(
      (id) => id && accounts.some((a) => a.id === id && !a.archived),
    );

  const [type, setType] = useState<TransactionType>(
    original?.type ?? (editor.mode === 'new' ? editor.type : 'expense'),
  );
  const [accountId, setAccountId] = useState<string | undefined>(defaultAccount);
  const [toAccountId, setToAccountId] = useState<string | undefined>(
    original?.toAccountId ?? preset?.toAccountId,
  );
  const [categoryId, setCategoryId] = useState<string | undefined>(
    original?.categoryId ?? preset?.categoryId,
  );
  const account = accounts.find((a) => a.id === accountId);
  const target = accounts.find((a) => a.id === toAccountId);
  const digits = fractionDigits(account?.currency ?? settings.defaultCurrency);
  const [expr, setExpr] = useState(() => {
    const amount = original?.amount ?? preset?.amount;
    return amount ? toDecimalString(amount, digits, '.') : '';
  });
  const [toAmountText, setToAmountText] = useState(() =>
    original?.toAmount !== undefined && target
      ? toDecimalString(original.toAmount, fractionDigits(target.currency), ',')
      : '',
  );
  const [date, setDate] = useState(() =>
    toDateTimeInput(original?.date ?? Date.now(), settings.timeZone),
  );
  const [note, setNote] = useState(original?.note ?? preset?.note ?? '');
  const [tags, setTags] = useState((original?.tags ?? preset?.tags ?? []).join(', '));
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Новая операция без категории сразу открывает выбор категории, как в 1Money.
  const [picker, setPicker] = useState<'account' | 'target' | 'category' | null>(() =>
    editor.mode === 'new' && !preset?.categoryId && editor.type !== 'transfer' ? 'category' : null,
  );
  const balances = useBalances();
  const category = categories.find((c) => c.id === categoryId);
  const parentCategory = category?.parentId
    ? categories.find((c) => c.id === category.parentId)
    : undefined;
  // Подкатегории выбранной категории — строкой значков под блоками «откуда → куда».
  const rootCategory = parentCategory ?? category;
  const subcategories = useMemo(
    () =>
      rootCategory
        ? categories
            .filter((c) => c.parentId === rootCategory.id && (!c.archived || c.id === categoryId))
            .sort(byOrder)
        : [],
    [categories, rootCategory, categoryId],
  );

  const amountResult = useMemo(() => {
    try {
      return { value: evaluate(expr, digits) };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [expr, digits]);

  const crossCurrency =
    type === 'transfer' && account && target && account.currency !== target.currency;

  const onKey = useCallback(
    (k: string) => {
      setError(null);
      if (k === '=') {
        setExpr((e) => {
          try {
            const v = evaluate(e, digits);
            return v === 0 ? '' : toDecimalString(v, digits, '.');
          } catch {
            return e;
          }
        });
      } else {
        setExpr((e) => applyKey(e, k, digits));
      }
    },
    [digits],
  );

  const submit = async () => {
    const amount = amountResult.value;
    if (amount === undefined) return setError(amountResult.error ?? tr('editor.invalidAmount'));
    if (amount === 0) return setError(tr('editor.enterAmount'));
    if (!account) return setError(tr('editor.chooseAccount'));
    let toAmount: number | undefined;
    if (type === 'transfer') {
      if (!target) return setError(tr('editor.chooseTargetAccount'));
      if (target.id === account.id) return setError(tr('editor.sameAccounts'));
      if (amount < 0) return setError(tr('editor.transferPositive'));
      if (crossCurrency) {
        const parsed = tryParseMinor(toAmountText, fractionDigits(target.currency));
        if (parsed === null || parsed <= 0) return setError(tr('editor.enterTargetAmount'));
        toAmount = parsed;
      }
    } else if (!categoryId) {
      return setError(tr('editor.chooseCategory'));
    }
    const now = Date.now();
    const t: Transaction = {
      id: original?.id ?? newId(),
      type,
      accountId: account.id,
      toAccountId: type === 'transfer' ? target!.id : undefined,
      categoryId: type === 'transfer' ? undefined : categoryId,
      amount,
      isRefund: type !== 'transfer' && amount < 0,
      toAmount,
      currency: account.currency,
      date: fromDateTimeInput(date, settings.timeZone),
      note: note.trim(),
      tags: tags
        .split(',')
        .map((s) => s.trim().replace(/^#/, ''))
        .filter(Boolean),
      createdAt: original?.createdAt ?? now,
      updatedAt: now,
      source: original?.source,
    };
    await saveTransaction(t);
    onClose();
    toast({ text: original ? tr('editor.saved') : tr('editor.added') });
    checkBudgetsAfterSave(t);
  };

  const remove = async () => {
    if (!original) return;
    await deleteTransaction(original.id);
    onClose();
    toast({
      text: tr('editor.deleted'),
      action: { label: tr('common.undo'), run: () => void saveTransaction(original) },
    });
  };

  const display =
    expr === ''
      ? '0'
      : expr
          .replace(/\*/g, '×')
          .replace(/\//g, '÷')
          .replace(/-/g, '−')
          .replace(/\./g, numberSeparators().decimal);
  const currency = account?.currency ?? settings.defaultCurrency;

  return (
    <BottomSheet
      open
      tall
      onClose={onClose}
      title={original ? tr('editor.editTitle') : tr('editor.newTitle')}
      headerExtra={
        original && (
          <IconButton label={tr('editor.delete')} onClick={() => setConfirmDelete(true)}>
            <Trash2 size={20} className="text-expense" />
          </IconButton>
        )
      }
      footer={
        <div className="flex flex-col gap-2">
          <div className="flex items-end justify-between gap-2 rounded-2xl bg-surface-2 px-4 py-2">
            <div className="min-w-0 flex-1">
              <output
                aria-label={tr('editor.amount')}
                aria-live="polite"
                className={`tabular block truncate text-right text-3xl font-bold ${type === 'income' ? 'text-income' : type === 'expense' ? 'text-expense' : ''}`}
              >
                {display}
              </output>
              {hasOperator(expr) && amountResult.value !== undefined && (
                <div className="tabular text-right text-sm text-muted">
                  = {formatMinor(amountResult.value, digits)}
                </div>
              )}
            </div>
            <span className="pb-1 text-lg font-semibold text-muted">{currency}</span>
          </div>
          {error && (
            <p role="alert" className="text-center text-sm font-medium text-expense">
              {error}
            </p>
          )}
          {amountResult.value !== undefined && amountResult.value < 0 && type !== 'transfer' && (
            <p className="text-center text-sm text-muted">
              {tr('editor.refundHint')} {formatMoney(amountResult.value, currency)}
            </p>
          )}
          <CalcKeypad onKey={onKey} onSubmit={submit} submitLabel={tr('common.save')} />
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <SegmentedControl
          label={tr('editor.type')}
          size="sm"
          value={type}
          options={TYPES.map((o) => ({ value: o.value, label: tr(o.label) }))}
          onChange={(v) => {
            setType(v);
            setError(null);
            if (v !== type) setCategoryId(undefined);
          }}
        />

        <div className="flex items-stretch gap-2">
          {type === 'income' ? (
            <FlowEndpoint
              caption={tr('editor.fromCategory')}
              name={category?.name}
              detail={parentCategory?.name}
              color={category?.color}
              icon={category?.icon}
              onClick={() => setPicker('category')}
            />
          ) : (
            <FlowEndpoint
              caption={tr('editor.fromAccount')}
              name={account?.name}
              detail={account && formatMoney(balances.get(account.id) ?? 0, account.currency)}
              color={account?.color}
              icon={account?.icon}
              onClick={() => setPicker('account')}
            />
          )}
          <span className="flex items-center text-muted" aria-hidden="true">
            <ArrowRight size={20} />
          </span>
          {type === 'expense' ? (
            <FlowEndpoint
              align="right"
              caption={tr('editor.toCategory')}
              name={category?.name}
              detail={parentCategory?.name}
              color={category?.color}
              icon={category?.icon}
              onClick={() => setPicker('category')}
            />
          ) : type === 'income' ? (
            <FlowEndpoint
              align="right"
              caption={tr('editor.toAccount')}
              name={account?.name}
              detail={account && formatMoney(balances.get(account.id) ?? 0, account.currency)}
              color={account?.color}
              icon={account?.icon}
              onClick={() => setPicker('account')}
            />
          ) : (
            <FlowEndpoint
              align="right"
              caption={tr('editor.toAccount')}
              name={target?.name}
              detail={target && formatMoney(balances.get(target.id) ?? 0, target.currency)}
              color={target?.color}
              icon={target?.icon}
              onClick={() => setPicker('target')}
            />
          )}
        </div>

        {rootCategory && subcategories.length > 0 && (
          <SubcategoryBubbles
            parent={rootCategory}
            subcategories={subcategories}
            value={categoryId}
            onChange={(id) => {
              setCategoryId(id);
              setError(null);
            }}
          />
        )}

        {crossCurrency && target && (
          <label className="flex items-center gap-2">
            <span className="text-sm text-muted">
              {tr('editor.credited', { currency: target.currency })}
            </span>
            <TextInput
              inputMode="decimal"
              value={toAmountText}
              onChange={(e) => setToAmountText(e.target.value)}
              placeholder="0"
              className="flex-1"
            />
          </label>
        )}

        <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
          <TextInput
            type="datetime-local"
            aria-label={tr('editor.dateTime')}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <TextInput
            aria-label={tr('common.note')}
            placeholder={tr('common.note')}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <TextInput
          aria-label={tr('editor.tags')}
          placeholder={tr('editor.tags')}
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />
      </div>

      <AccountPickerSheet
        open={picker === 'account' || picker === 'target'}
        title={
          picker === 'target' || type === 'income'
            ? tr('editor.toAccount')
            : tr('editor.fromAccount')
        }
        accounts={sortedAccounts}
        value={picker === 'target' ? toAccountId : accountId}
        exclude={picker === 'target' ? accountId : undefined}
        onChange={(id) => {
          if (picker === 'target') setToAccountId(id);
          else setAccountId(id);
          setError(null);
        }}
        onClose={() => setPicker(null)}
      />
      <BottomSheet
        open={picker === 'category'}
        onClose={() => setPicker(null)}
        title={type === 'income' ? tr('editor.incomeCategory') : tr('editor.expenseCategory')}
      >
        {type !== 'transfer' && (
          <CategoryGrid
            categories={categories}
            kind={type}
            value={categoryId}
            onChange={(id) => {
              setCategoryId(id);
              setError(null);
              setPicker(null);
            }}
          />
        )}
      </BottomSheet>
      <ConfirmDialog
        open={confirmDelete}
        title={tr('editor.deleteConfirm')}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={remove}
      />
    </BottomSheet>
  );
}

import { budgetStatus, budgetsAffectedBy, isBudgetActive } from '../../domain/budgets';
import { monthKey } from '../../domain/dates';
import { formatMoney } from '../../domain/money';
import type { Transaction } from '../../domain/types';
import { useData } from '../../stores/dataStore';
import { useUi } from '../../stores/uiStore';

/** Показывает предупреждение, если сохранённая операция приблизила или вывела бюджет за лимит. */
export function checkBudgetsAfterSave(t: Transaction): void {
  const { budgets, categories, transactions, settings } = useData.getState();
  const month = monthKey(t.date, settings.timeZone);
  const affected = budgetsAffectedBy(t, budgets, categories).filter((b) =>
    isBudgetActive(b, month),
  );
  const statuses = affected
    .map((b) => budgetStatus(b, month, transactions, categories, settings.timeZone))
    .filter((s) => s.level !== 'ok')
    .sort((a, b) => b.ratio - a.ratio);
  const worst = statuses[0];
  if (!worst) return;
  const name = worst.budget.categoryId
    ? (categories.find((c) => c.id === worst.budget.categoryId)?.name ?? 'Категория')
    : 'Все расходы';
  const spent = formatMoney(worst.spent, worst.budget.currency);
  const limit = formatMoney(worst.limit, worst.budget.currency);
  useUi.getState().toast(
    worst.level === 'over'
      ? { tone: 'error', text: `Бюджет «${name}» превышен: ${spent} из ${limit}`, duration: 6000 }
      : {
          tone: 'warning',
          text: `Бюджет «${name}»: потрачено ${Math.round(worst.ratio * 100)}% (${spent} из ${limit})`,
          duration: 5000,
        },
  );
}

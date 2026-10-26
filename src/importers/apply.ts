import type { Repositories } from '../repositories';
import type { ImportPlan } from './types';

/**
 * Записывает план импорта одной транзакцией IndexedDB: либо всё, либо ничего.
 * Записи с теми же ID обновляются, поэтому повторный импорт того же файла не создаёт дублей.
 */
export async function applyImportPlan(plan: ImportPlan, repos: Repositories): Promise<void> {
  await repos.atomically(async () => {
    await repos.accounts.bulkPut(plan.accounts);
    await repos.categories.bulkPut(plan.categories);
    await repos.budgets.bulkPut(plan.budgets);
    await repos.debts.bulkPut(plan.debts);
    await repos.recurring.bulkPut(plan.recurring);
    await repos.transactions.bulkPut(plan.transactions);
  });
}

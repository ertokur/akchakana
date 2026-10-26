import { dueOccurrences, nextOccurrenceAfter } from '../../domain/recurrence';
import { newId } from '../../domain/ids';
import { formatMoney } from '../../domain/money';
import type { RecurringRule, Timestamp, Transaction } from '../../domain/types';
import { useData } from '../../stores/dataStore';
import { showNotification } from './notifications';

export function transactionFromRule(
  rule: RecurringRule,
  date: Timestamp,
  now = Date.now(),
): Transaction {
  const t = rule.template;
  return {
    id: newId(),
    type: t.type,
    accountId: t.accountId,
    toAccountId: t.type === 'transfer' ? t.toAccountId : undefined,
    categoryId: t.type === 'transfer' ? undefined : t.categoryId,
    amount: t.amount,
    isRefund: t.amount < 0,
    toAmount: t.toAmount,
    currency: t.currency,
    date,
    note: t.note || rule.name,
    tags: t.tags,
    createdAt: now,
    updatedAt: now,
  };
}

/** Правило после обработки повторения at: nextDate сдвигается, при окончании правило выключается. */
export function advanceRule(
  rule: RecurringRule,
  at: Timestamp,
  timeZone: string,
  now = Date.now(),
): RecurringRule {
  const next = nextOccurrenceAfter(rule, at, timeZone);
  return next === null
    ? { ...rule, active: false, updatedAt: now }
    : { ...rule, nextDate: next, updatedAt: now };
}

/** Правила с напоминанием, у которых наступил срок. */
export function dueReminders(rules: RecurringRule[], now: Timestamp): RecurringRule[] {
  return rules
    .filter((r) => r.active && r.mode === 'remind' && r.nextDate <= now)
    .sort((a, b) => a.nextDate - b.nextDate);
}

/**
 * Обрабатывает наступившие повторения: «auto» создаёт операции, «remind» показывает
 * уведомление (один раз на повторение). Возвращает число созданных операций.
 */
export async function runScheduler(now = Date.now()): Promise<number> {
  const { recurring, settings, saveTransactions, saveRecurring } = useData.getState();
  let created = 0;
  for (const rule of recurring) {
    if (!rule.active || rule.nextDate > now) continue;
    if (rule.mode === 'auto') {
      const dates = dueOccurrences(rule, now, settings.timeZone);
      if (dates.length === 0) continue;
      await saveTransactions(dates.map((d) => transactionFromRule(rule, d, now)));
      await saveRecurring(advanceRule(rule, dates[dates.length - 1], settings.timeZone, now));
      created += dates.length;
    } else if ((rule.lastNotifiedAt ?? 0) < rule.nextDate) {
      if (settings.notificationsEnabled) {
        await showNotification(
          'Регулярный платёж',
          `${rule.name}: ${formatMoney(rule.template.amount, rule.template.currency)}`,
          `rule-${rule.id}`,
        );
      }
      await saveRecurring({ ...rule, lastNotifiedAt: now });
    }
  }
  return created;
}

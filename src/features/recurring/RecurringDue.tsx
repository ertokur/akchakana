import { Repeat } from 'lucide-react';
import { formatInTz } from '../../domain/dates';
import { formatMoney } from '../../domain/money';
import type { RecurringRule } from '../../domain/types';
import { useData } from '../../stores/dataStore';
import { useUi } from '../../stores/uiStore';
import { Button } from '../../ui/controls';
import { useNow } from '../shared/hooks';
import { advanceRule, dueReminders, transactionFromRule } from './scheduler';

/** Карточки «пора оплатить» для правил с напоминанием. */
export function RecurringDue() {
  const recurring = useData((s) => s.recurring);
  const timeZone = useData((s) => s.settings.timeZone);
  const saveTransaction = useData((s) => s.saveTransaction);
  const saveRecurring = useData((s) => s.saveRecurring);
  const toast = useUi((s) => s.toast);
  const now = useNow();
  const due = dueReminders(recurring, now);
  if (due.length === 0) return null;

  const confirm = async (rule: RecurringRule) => {
    await saveTransaction(transactionFromRule(rule, rule.nextDate));
    await saveRecurring(advanceRule(rule, rule.nextDate, timeZone));
    toast({ text: `Операция «${rule.name}» добавлена` });
  };
  const skip = async (rule: RecurringRule) => {
    await saveRecurring(advanceRule(rule, rule.nextDate, timeZone));
  };

  return (
    <section aria-label="Регулярные платежи к оплате" className="mb-4 flex flex-col gap-2">
      {due.map((rule) => (
        <div key={rule.id} className="rounded-2xl border border-accent bg-accent-soft p-3">
          <div className="flex items-center gap-2">
            <Repeat size={18} aria-hidden="true" className="text-accent-strong" />
            <span className="flex-1 font-semibold">{rule.name}</span>
            <span className="tabular font-semibold">
              {formatMoney(rule.template.amount, rule.template.currency)}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">
            Срок: {formatInTz(rule.nextDate, timeZone, 'd MMMM, HH:mm')}
          </p>
          <div className="mt-2 flex gap-2">
            <Button className="flex-1" onClick={() => confirm(rule)}>
              Добавить операцию
            </Button>
            <Button variant="secondary" onClick={() => skip(rule)}>
              Пропустить
            </Button>
          </div>
        </div>
      ))}
    </section>
  );
}

import { navigate } from '../../app/router';
import { CHANGELOG } from '../../changelog';
import { formatInTz } from '../../domain/dates';
import { startOfDayKey } from '../../domain/dates';
import { useData } from '../../stores/dataStore';
import { Card } from '../../ui/controls';
import { Screen } from '../../ui/Screen';

/** «Что нового»: изменения по версиям, новые сверху. */
export function ChangelogScreen() {
  const timeZone = useData((s) => s.settings.timeZone);
  return (
    <Screen title="Что нового" onBack={() => navigate('more')}>
      <ol className="flex flex-col gap-4" aria-label="Версии">
        {CHANGELOG.map((entry, i) => (
          <li key={entry.version}>
            <Card>
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h2 className="text-lg font-bold">
                  Версия {entry.version.replace(/\.0$/, '')}
                  {i === 0 && (
                    <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 align-middle text-xs font-semibold text-accent-strong">
                      текущая
                    </span>
                  )}
                </h2>
                <time dateTime={entry.date} className="text-sm text-muted">
                  {formatInTz(
                    startOfDayKey(entry.date, timeZone) + 12 * 3600_000,
                    timeZone,
                    'd MMMM yyyy',
                  )}
                </time>
              </div>
              <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">
                {entry.changes.ru.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </Card>
          </li>
        ))}
      </ol>
    </Screen>
  );
}

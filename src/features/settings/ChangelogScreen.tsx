import { navigate } from '../../app/router';
import { CHANGELOG } from '../../changelog';
import { formatDate, startOfDayKey } from '../../domain/dates';
import { useLang, useT } from '../../i18n';
import { useData } from '../../stores/dataStore';
import { Card } from '../../ui/controls';
import { Screen } from '../../ui/Screen';

/** «Что нового»: изменения по версиям, новые сверху, на языке интерфейса. */
export function ChangelogScreen() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const timeZone = useData((s) => s.settings.timeZone);
  return (
    <Screen title={t('changelog.title')} onBack={() => navigate('more')}>
      <ol className="flex flex-col gap-4" aria-label={t('changelog.versions')}>
        {CHANGELOG.map((entry, i) => (
          <li key={entry.version}>
            <Card>
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h2 className="text-lg font-bold">
                  {t('changelog.version', { version: entry.version.replace(/\.0$/, '') })}
                  {i === 0 && (
                    <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 align-middle text-xs font-semibold text-accent-strong">
                      {t('changelog.current')}
                    </span>
                  )}
                </h2>
                <time dateTime={entry.date} className="text-sm text-muted">
                  {formatDate(
                    startOfDayKey(entry.date, timeZone) + 12 * 3600_000,
                    timeZone,
                    'dayMonthYear',
                  )}
                </time>
              </div>
              <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">
                {entry.changes[lang].map((item) => (
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

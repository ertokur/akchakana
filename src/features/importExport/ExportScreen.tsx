import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { navigate } from '../../app/router';
import { customPeriod, formatDate } from '../../domain/dates';
import { buildOwnCsv, exportFileName, filterExport } from '../../exporters/ownCsv';
import { shareOrDownload } from '../../exporters/share';
import { byOrder, useData } from '../../stores/dataStore';
import { useUi } from '../../stores/uiStore';
import { Button, Card, Field, SegmentedControl, TextInput, Toggle } from '../../ui/controls';
import { Screen } from '../../ui/Screen';
import { usePeriodOptions } from '../shared/hooks';
import { useT } from '../../i18n';

export function ExportScreen() {
  const t = useT();
  const data = useData();
  const updateSettings = useData((s) => s.updateSettings);
  const toast = useUi((s) => s.toast);
  const opts = usePeriodOptions();
  const accounts = useMemo(() => [...data.accounts].sort(byOrder), [data.accounts]);
  const [range, setRange] = useState<'all' | 'custom'>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const period = range === 'custom' && from && to ? customPeriod(from, to, opts) : undefined;
    return filterExport(data, {
      from: period?.start,
      to: period?.end,
      accountIds: excluded.size
        ? accounts.filter((a) => !excluded.has(a.id)).map((a) => a.id)
        : undefined,
    });
  }, [data, range, from, to, opts, excluded, accounts]);

  const run = async () => {
    setBusy(true);
    try {
      const now = Date.now();
      const csv = buildOwnCsv(filtered, opts.timeZone);
      const result = await shareOrDownload(csv, exportFileName(now, opts.timeZone));
      if (result !== 'cancelled') {
        await updateSettings({ lastExportAt: now, exportSnoozedUntil: undefined });
        toast({ text: result === 'shared' ? t('export.shared') : t('export.saved') });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title={t('more.export')} onBack={() => navigate('more')}>
      <div className="flex flex-col gap-4">
        <Card className="text-sm text-muted">
          {t('export.description')}
          {data.settings.lastExportAt && (
            <span className="mt-1 block">
              {t('export.last', {
                date: formatDate(data.settings.lastExportAt, opts.timeZone, 'dayMonthYearTime'),
              })}
            </span>
          )}
        </Card>
        <Card className="flex flex-col gap-3">
          <SegmentedControl
            label={t('export.range')}
            value={range}
            options={[
              { value: 'all', label: t('export.allTime') },
              { value: 'custom', label: t('period.title') },
            ]}
            onChange={setRange}
          />
          {range === 'custom' && (
            <div className="grid grid-cols-2 gap-2">
              <Field label={t('period.from')}>
                {(id) => (
                  <TextInput
                    id={id}
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                )}
              </Field>
              <Field label={t('period.to')}>
                {(id) => (
                  <TextInput
                    id={id}
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                  />
                )}
              </Field>
            </div>
          )}
        </Card>
        {accounts.length > 1 && (
          <Card>
            <h2 className="mb-1 font-semibold">{t('export.byAccount')}</h2>
            {accounts.map((a) => (
              <Toggle
                key={a.id}
                checked={!excluded.has(a.id)}
                onChange={(on) => {
                  const next = new Set(excluded);
                  if (on) next.delete(a.id);
                  else next.add(a.id);
                  setExcluded(next);
                }}
                label={a.name}
              />
            ))}
          </Card>
        )}
        <p className="text-sm text-muted">
          {t('export.counts', {
            transactions: filtered.transactions.length,
            accounts: filtered.accounts.length,
            categories: filtered.categories.length,
            budgets: filtered.budgets.length,
          })}
        </p>
        <Button block disabled={busy || (range === 'custom' && (!from || !to))} onClick={run}>
          <Download size={20} aria-hidden="true" /> {t('export.run')}
        </Button>
      </div>
    </Screen>
  );
}

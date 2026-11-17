import { useMemo, useRef, useState } from 'react';
import { FileUp } from 'lucide-react';
import type { SqlJsStatic } from 'sql.js';
import { navigate } from '../../app/router';
import { defaultCategories } from '../../db/seed';
import { COMMON_CURRENCIES } from '../../domain/money';
import { getRepositories } from '../../repositories';
import { applyImportPlan } from '../../importers/apply';
import {
  analyzeCsv,
  CSV_FIELDS,
  csvFieldLabel,
  DATE_FORMATS,
  detectDateFormat,
  guessMapping,
  parseCsv,
  type CsvField,
  type CsvImportOptions,
  type DateFormat,
  type ParsedCsv,
} from '../../importers/csvGeneric';
import { detectFile } from '../../importers/detect';
import { parseOneMoneyBackup } from '../../importers/oneMoneyBackup';
import { parseOwnCsv } from '../../importers/ownCsv';
import type { ImportPlan } from '../../importers/types';
import { byOrder, useData } from '../../stores/dataStore';
import { useUi } from '../../stores/uiStore';
import { Button, Card, Field, Select, Toggle } from '../../ui/controls';
import { Screen } from '../../ui/Screen';
import { ImportSummary } from './ImportSummary';
import { useT } from '../../i18n';

type Step =
  | { kind: 'pick' }
  | { kind: 'onemoney'; bytes: Uint8Array; SQL: SqlJsStatic; currency: string }
  | { kind: 'own'; plan: ImportPlan }
  | { kind: 'csv'; csv: ParsedCsv; encoding: string };

const ENCODING_LABELS: Record<string, string> = {
  'utf-8': 'UTF-8',
  'utf-8-bom': 'UTF-8 BOM',
  'windows-1251': 'Windows-1251',
};

export function ImportScreen() {
  const t = useT();
  const settings = useData((s) => s.settings);
  const [step, setStep] = useState<Step>({ kind: 'pick' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const detected = detectFile(bytes);
      if (detected.kind === 'unknown') return setError(detected.reason);
      if (detected.kind === 'sqlite') {
        // sql.js и wasm загружаются только когда действительно нужны.
        const { loadSqlJs } = await import('../../importers/sqlLoader');
        const SQL = await loadSqlJs();
        setStep({ kind: 'onemoney', bytes, SQL, currency: settings.defaultCurrency });
      } else if (detected.kind === 'own') {
        setStep({ kind: 'own', plan: parseOwnCsv(detected.text) });
      } else {
        const csv = parseCsv(detected.text);
        if (csv.headers.length < 2 || csv.rows.length === 0) {
          return setError(t('import.err.noTable2'));
        }
        setStep({ kind: 'csv', csv, encoding: detected.encoding });
      }
    } catch (e) {
      setError(t('import.err.readFailed', { message: (e as Error).message }));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const reset = () => setStep({ kind: 'pick' });

  return (
    <Screen
      title={t('more.import')}
      onBack={settings.onboarded ? () => navigate('more') : () => navigate('home')}
    >
      {step.kind === 'pick' && (
        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-3">
            <h2 className="font-semibold">{t('import.pickTitle')}</h2>
            <p className="text-sm text-muted">{t('import.pickText')}</p>
            <input
              ref={fileRef}
              type="file"
              className="sr-only"
              id="import-file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
              }}
            />
            <label
              htmlFor="import-file"
              className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent px-4 font-semibold text-accent-fg"
            >
              <FileUp size={20} aria-hidden="true" />{' '}
              {busy ? t('import.reading') : t('import.chooseFile')}
            </label>
            {error && (
              <p role="alert" className="text-sm font-medium text-expense">
                {error}
              </p>
            )}
          </Card>
          <Card className="text-sm text-muted">{t('import.howToBackup')}</Card>
        </div>
      )}
      {step.kind === 'onemoney' && <OneMoneyStep step={step} onChange={setStep} onCancel={reset} />}
      {step.kind === 'own' && (
        <Confirm plan={step.plan} title={t('import.ownFile')} onCancel={reset} />
      )}
      {step.kind === 'csv' && <CsvSteps csv={step.csv} encoding={step.encoding} onCancel={reset} />}
    </Screen>
  );
}

function OneMoneyStep({
  step,
  onChange,
  onCancel,
}: {
  step: Extract<Step, { kind: 'onemoney' }>;
  onChange: (s: Step) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const plan = useMemo(
    () => parseOneMoneyBackup(step.SQL, step.bytes, { currency: step.currency }),
    [step.SQL, step.bytes, step.currency],
  );
  const currencies = COMMON_CURRENCIES.includes(step.currency)
    ? COMMON_CURRENCIES
    : [step.currency, ...COMMON_CURRENCIES];
  return (
    <Confirm
      plan={plan}
      title={t('import.otherAppBackup')}
      onCancel={onCancel}
      before={
        <Card className="flex flex-col gap-2">
          <Field label={t('import.backupCurrency')} hint={t('import.backupCurrencyHint')}>
            {(id) => (
              <Select
                id={id}
                value={step.currency}
                onChange={(e) => onChange({ ...step, currency: e.target.value })}
              >
                {currencies.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            )}
          </Field>
        </Card>
      }
    />
  );
}

function Confirm({
  plan,
  title,
  onCancel,
  before,
}: {
  plan: ImportPlan;
  title: string;
  onCancel: () => void;
  before?: React.ReactNode;
}) {
  const t = useT();
  const settings = useData((s) => s.settings);
  const load = useData((s) => s.load);
  const updateSettings = useData((s) => s.updateSettings);
  const toast = useUi((s) => s.toast);
  const [busy, setBusy] = useState(false);
  const total =
    plan.transactions.length +
    plan.accounts.length +
    plan.categories.length +
    plan.budgets.length +
    plan.debts.length +
    plan.recurring.length;

  const run = async () => {
    setBusy(true);
    try {
      await applyImportPlan(plan, getRepositories());
      await load();
      // Если в файле не было категорий, а в приложении их нет совсем — добавим стандартные.
      if (useData.getState().categories.length === 0) {
        await useData.getState().saveCategories(defaultCategories());
      }
      if (!settings.onboarded) await updateSettings({ onboarded: true });
      toast({ text: t('import.done', { count: plan.transactions.length }) });
      navigate('home');
    } catch (e) {
      toast({ text: t('import.failed', { message: (e as Error).message }), tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      {before}
      <ImportSummary plan={plan} timeZone={settings.timeZone} />
      <p className="text-sm text-muted">{t('import.updateHint')}</p>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button block disabled={busy || total === 0} onClick={run}>
          {busy ? t('import.importing') : t('import.run')}
        </Button>
      </div>
    </div>
  );
}

function CsvSteps({
  csv,
  encoding,
  onCancel,
}: {
  csv: ParsedCsv;
  encoding: string;
  onCancel: () => void;
}) {
  const t = useT();
  const accounts = useData((s) => s.accounts);
  const categories = useData((s) => s.categories);
  const transactions = useData((s) => s.transactions);
  const settings = useData((s) => s.settings);
  const activeAccounts = useMemo(
    () => accounts.filter((a) => !a.archived).sort(byOrder),
    [accounts],
  );

  const [mapping, setMapping] = useState<CsvField[]>(() => guessMapping(csv.headers));
  const dateCol = mapping.indexOf('date');
  const detectedFormat = useMemo(
    () => (dateCol >= 0 ? detectDateFormat(csv.rows.map((r) => r[dateCol] ?? '')) : null),
    [csv, dateCol],
  );
  const [dateFormat, setDateFormat] = useState<DateFormat | ''>('');
  const effectiveFormat = dateFormat || detectedFormat || 'dd.MM.yyyy';
  const [defaultAccountId, setDefaultAccountId] = useState(activeAccounts[0]?.id ?? '');
  const [currency, setCurrency] = useState(settings.defaultCurrency);
  const [reviewing, setReviewing] = useState(false);
  const [skipAccounts, setSkipAccounts] = useState<Set<string>>(new Set());
  const [skipCategories, setSkipCategories] = useState<Set<string>>(new Set());
  const [includeDuplicates, setIncludeDuplicates] = useState(false);

  const existing = { accounts, categories, transactions };
  const baseOptions: CsvImportOptions = {
    mapping,
    dateFormat: effectiveFormat,
    timeZone: settings.timeZone,
    defaultCurrency: currency,
    defaultAccountId: mapping.includes('account') ? undefined : defaultAccountId || undefined,
    createAccounts: new Set(),
    createCategories: new Set(),
    includeDuplicates,
  };
  // Первый проход — чтобы узнать, каких счетов и категорий не хватает.
  const discovery = reviewing ? analyzeCsv(csv, baseOptions, existing) : null;
  const analysis = discovery
    ? analyzeCsv(
        csv,
        {
          ...baseOptions,
          createAccounts: new Set(discovery.missingAccounts.filter((n) => !skipAccounts.has(n))),
          createCategories: new Set(
            discovery.missingCategories
              .map((c) => `${c.kind}|${c.name}`)
              .filter((k) => !skipCategories.has(k)),
          ),
        },
        existing,
      )
    : null;

  const toggle = (set: Set<string>, key: string, update: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    update(next);
  };

  if (analysis && discovery) {
    return (
      <div className="flex flex-col gap-4">
        {(discovery.missingAccounts.length > 0 || discovery.missingCategories.length > 0) && (
          <Card className="flex flex-col gap-1">
            <h2 className="font-semibold">{t('import.newItems')}</h2>
            <p className="text-sm text-muted">{t('import.newItemsHint')}</p>
            {discovery.missingAccounts.map((name) => (
              <Toggle
                key={`a-${name}`}
                checked={!skipAccounts.has(name)}
                onChange={() => toggle(skipAccounts, name, setSkipAccounts)}
                label={t('import.newAccount', { name })}
              />
            ))}
            {discovery.missingCategories.map((c) => {
              const key = `${c.kind}|${c.name}`;
              return (
                <Toggle
                  key={`c-${key}`}
                  checked={!skipCategories.has(key)}
                  onChange={() => toggle(skipCategories, key, setSkipCategories)}
                  label={t(
                    c.kind === 'expense' ? 'import.newExpenseCategory' : 'import.newIncomeCategory',
                    {
                      name: c.name,
                    },
                  )}
                />
              );
            })}
          </Card>
        )}
        <Card>
          <Toggle
            checked={includeDuplicates}
            onChange={setIncludeDuplicates}
            label={t('import.duplicates')}
            description={t('import.duplicatesHint')}
          />
        </Card>
        <Confirm
          plan={analysis.plan}
          title={t('import.csvReview')}
          onCancel={() => setReviewing(false)}
        />
        <Button variant="ghost" onClick={onCancel}>
          {t('import.otherFile')}
        </Button>
      </div>
    );
  }

  const preview = csv.rows.slice(0, 5);
  return (
    <div className="flex flex-col gap-4">
      <Card className="text-sm text-muted">
        {t('import.csvInfo', {
          rows: csv.rows.length,
          delimiter: csv.delimiter,
          encoding: ENCODING_LABELS[encoding] ?? encoding,
        })}
      </Card>
      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold">{t('import.mapColumns')}</h2>
        {csv.headers.map((h, i) => (
          <Field
            key={i}
            label={t('import.columnLabel', {
              name: h || t('import.column', { n: i + 1 }),
              example: preview[0]?.[i] || '—',
            })}
          >
            {(id) => (
              <Select
                id={id}
                value={mapping[i]}
                onChange={(e) => {
                  const next = [...mapping];
                  const field = e.target.value as CsvField;
                  // Одно поле — одна колонка.
                  if (field !== 'ignore') {
                    const prev = next.indexOf(field);
                    if (prev >= 0) next[prev] = 'ignore';
                  }
                  next[i] = field;
                  setMapping(next);
                }}
              >
                {CSV_FIELDS.map((k) => (
                  <option key={k} value={k}>
                    {csvFieldLabel(k)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ))}
      </Card>
      <Card className="flex flex-col gap-3">
        <Field
          label={t('import.dateFormat')}
          hint={
            detectedFormat ? t('import.dateFormatDetected', { format: detectedFormat }) : undefined
          }
        >
          {(id) => (
            <Select
              id={id}
              value={effectiveFormat}
              onChange={(e) => setDateFormat(e.target.value as DateFormat)}
            >
              {DATE_FORMATS.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </Select>
          )}
        </Field>
        {!mapping.includes('account') && (
          <Field label={t('import.accountForAll')}>
            {(id) => (
              <Select
                id={id}
                value={defaultAccountId}
                onChange={(e) => setDefaultAccountId(e.target.value)}
              >
                {activeAccounts.length === 0 && (
                  <option value="">{t('import.createAccountFirst')}</option>
                )}
                {activeAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.currency})
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        {mapping.includes('account') && !mapping.includes('currency') && (
          <Field label={t('import.newAccountsCurrency')}>
            {(id) => (
              <Select id={id} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {COMMON_CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            )}
          </Field>
        )}
      </Card>
      <Card>
        <h2 className="mb-2 font-semibold">{t('import.firstRows')}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                {csv.headers.map((_, i) => (
                  <th key={i} className="px-2 py-1 font-medium whitespace-nowrap text-muted">
                    {csvFieldLabel(mapping[i])}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map((r, ri) => (
                <tr key={ri} className="border-t border-border">
                  {csv.headers.map((_, ci) => (
                    <td
                      key={ci}
                      className={`px-2 py-1 whitespace-nowrap ${mapping[ci] === 'ignore' ? 'text-muted line-through' : ''}`}
                    >
                      {r[ci]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button
          block
          disabled={!mapping.includes('date') || !mapping.includes('amount')}
          onClick={() => setReviewing(true)}
        >
          {t('import.next')}
        </Button>
      </div>
    </div>
  );
}

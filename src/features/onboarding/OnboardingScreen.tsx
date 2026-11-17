import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, FileUp, Globe, Wallet } from 'lucide-react';
import { ACCOUNT_KINDS, defaultCategories, makeAccount, PALETTE } from '../../db/seed';
import { COMMON_CURRENCIES, fractionDigits, tryParseMinor } from '../../domain/money';
import type { AccountKind } from '../../domain/types';
import {
  LANGUAGE_NAMES,
  LANGUAGES,
  systemLanguage,
  useT,
  type DictKey,
  type LanguageSetting,
} from '../../i18n';
import { useData } from '../../stores/dataStore';
import { Button, Field, IconButton, Select, TextInput } from '../../ui/controls';
import { navigate } from '../../app/router';
import { AppLogo } from '../../ui/AppLogo';
import { MadeWith } from '../../ui/MadeWith';
import {
  AccountsIllustration,
  PrivacyIllustration,
  QuickAddIllustration,
  RingIllustration,
  StatsIllustration,
} from './Illustrations';

interface Slide {
  id: string;
  title: DictKey;
  text: DictKey;
  art: () => ReactNode;
}

/** Слайды с функциями приложения — между приветствием и созданием первого счёта. */
const FEATURES: Slide[] = [
  {
    id: 'ring',
    title: 'onboarding.ring.title',
    text: 'onboarding.ring.text',
    art: () => <RingIllustration />,
  },
  {
    id: 'quick-add',
    title: 'onboarding.quickAdd.title',
    text: 'onboarding.quickAdd.text',
    art: () => <QuickAddIllustration />,
  },
  {
    id: 'accounts',
    title: 'onboarding.accounts.title',
    text: 'onboarding.accounts.text',
    art: () => <AccountsIllustration />,
  },
  {
    id: 'stats',
    title: 'onboarding.stats.title',
    text: 'onboarding.stats.text',
    art: () => <StatsIllustration />,
  },
  {
    id: 'privacy',
    title: 'onboarding.privacy.title',
    text: 'onboarding.privacy.text',
    art: () => <PrivacyIllustration />,
  },
];

/** Всего шагов: приветствие + функции + старт. */
const STEPS = FEATURES.length + 2;
const START_STEP = STEPS - 1;

/**
 * Первый запуск: многостраничное знакомство с приложением, затем создание первого счёта
 * или импорт данных.
 */
export function OnboardingScreen() {
  const t = useT();
  const [step, setStep] = useState(0);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const go = (next: number) => setStep(Math.max(0, Math.min(START_STEP, next)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, select, textarea')) return;
      if (e.key === 'ArrowRight') setStep((s) => Math.min(START_STEP, s + 1));
      if (e.key === 'ArrowLeft') setStep((s) => Math.max(0, s - 1));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const isStart = step === START_STEP;

  return (
    <div
      className="px-gutter mx-auto flex min-h-dvh max-w-lg flex-col pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('input, select, textarea, button')) return;
        touch.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={(e) => {
        const tp = touch.current;
        touch.current = null;
        if (!tp || isStart) return;
        const dx = e.clientX - tp.x;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - tp.y)) {
          go(step + (dx < 0 ? 1 : -1));
        }
      }}
    >
      <header className="flex min-h-12 items-center justify-between">
        {step > 0 ? (
          <IconButton label={t('common.back')} onClick={() => go(step - 1)}>
            <ChevronLeft />
          </IconButton>
        ) : (
          <LanguageSwitch />
        )}
        {!isStart && (
          <button
            type="button"
            onClick={() => go(START_STEP)}
            className="min-h-11 rounded-xl px-3 font-medium text-muted hover:bg-surface-2"
          >
            {t('onboarding.skip')}
          </button>
        )}
      </header>

      <main
        className="flex flex-1 flex-col"
        aria-roledescription={t('onboarding.carouselRole')}
        aria-label={t('onboarding.carousel')}
      >
        {/* key — чтобы анимации запускались заново при каждом показе шага. */}
        <div key={step} className="flex flex-1 flex-col">
          {step === 0 && <Welcome />}
          {step > 0 && step <= FEATURES.length && (
            <FeatureSlide slide={FEATURES[step - 1]} index={step} />
          )}
          {isStart && <StartStep />}
        </div>
      </main>

      {!isStart && (
        <footer className="flex flex-col gap-4 pt-4">
          <Dots step={step} onSelect={go} />
          <Button block onClick={() => go(step + 1)}>
            {step === 0
              ? t('onboarding.tour')
              : step === FEATURES.length
                ? t('onboarding.begin')
                : t('onboarding.next')}
          </Button>
        </footer>
      )}
    </div>
  );
}

/** Компактный выбор языка на приветствии: язык можно сменить до знакомства. */
function LanguageSwitch() {
  const t = useT();
  const language = useData((s) => s.settings.language);
  const updateSettings = useData((s) => s.updateSettings);
  return (
    <label className="flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-sm text-muted hover:bg-surface-2">
      <Globe size={18} aria-hidden="true" />
      <span className="sr-only">{t('settings.language')}</span>
      <select
        value={language}
        onChange={(e) => void updateSettings({ language: e.target.value as LanguageSetting })}
        className="min-h-11 cursor-pointer bg-transparent pr-1 font-medium text-text focus:outline-none"
      >
        <option value="system">
          {t('settings.languageSystem', { name: LANGUAGE_NAMES[systemLanguage()] })}
        </option>
        {LANGUAGES.map((l) => (
          <option key={l} value={l} lang={l}>
            {LANGUAGE_NAMES[l]}
          </option>
        ))}
      </select>
    </label>
  );
}

function Dots({ step, onSelect }: { step: number; onSelect: (i: number) => void }) {
  const t = useT();
  return (
    <div className="flex justify-center gap-1" role="tablist" aria-label={t('onboarding.steps')}>
      {Array.from({ length: STEPS - 1 }, (_, i) => (
        <button
          key={i}
          type="button"
          role="tab"
          aria-selected={i === step}
          aria-label={t('onboarding.stepOf', { n: i + 1, total: STEPS - 1 })}
          onClick={() => onSelect(i)}
          className="flex h-11 items-center px-1"
        >
          <span
            className={`block h-2 rounded-full transition-all duration-300 ${i === step ? 'w-6 bg-accent' : 'w-2 bg-border'}`}
          />
        </button>
      ))}
    </div>
  );
}

function Welcome() {
  const t = useT();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
      <AppLogo size={128} animated />
      <div className="ob-fade-up flex flex-col gap-2" style={{ animationDelay: '900ms' }}>
        <h1 className="text-3xl font-bold">{t('app.name')}</h1>
        <p className="mx-auto max-w-xs text-muted">{t('onboarding.description')}</p>
      </div>
      <div className="ob-fade-up" style={{ animationDelay: '1200ms' }}>
        <MadeWith className="pt-1" />
      </div>
    </div>
  );
}

function FeatureSlide({ slide, index }: { slide: Slide; index: number }) {
  const t = useT();
  const title = t(slide.title);
  return (
    <section
      className="flex flex-1 flex-col justify-center gap-6"
      aria-roledescription={t('onboarding.slideRole')}
      aria-label={t('onboarding.slideLabel', { n: index, total: FEATURES.length, title })}
    >
      {slide.art()}
      <div
        className="ob-fade-up flex flex-col gap-2 text-center"
        style={{ animationDelay: '250ms' }}
      >
        <h2 className="text-2xl font-bold">{title}</h2>
        <p className="mx-auto max-w-xs text-muted">{t(slide.text)}</p>
      </div>
    </section>
  );
}

/** Последний шаг: первый счёт или импорт данных. */
function StartStep() {
  const t = useT();
  const settings = useData((s) => s.settings);
  const updateSettings = useData((s) => s.updateSettings);
  const saveAccount = useData((s) => s.saveAccount);
  const saveCategories = useData((s) => s.saveCategories);
  const hasCategories = useData((s) => s.categories.length > 0);
  const [currency, setCurrency] = useState(settings.defaultCurrency);
  const [name, setName] = useState(() => t('account.kind.cash'));
  const [kind, setKind] = useState<AccountKind>('cash');
  const [balance, setBalance] = useState('');
  const [error, setError] = useState<string | null>(null);

  const finish = async () => {
    const initialBalance =
      balance.trim() === '' ? 0 : tryParseMinor(balance, fractionDigits(currency));
    if (initialBalance === null) return setError(t('onboarding.err.balance'));
    if (!name.trim()) return setError(t('onboarding.err.name'));
    if (!hasCategories) await saveCategories(defaultCategories());
    await saveAccount(
      makeAccount({ name: name.trim(), currency, kind, initialBalance, color: PALETTE[0] }),
    );
    await requestPersistentStorage();
    await updateSettings({ defaultCurrency: currency, onboarded: true });
  };

  const importInstead = async () => {
    await updateSettings({ defaultCurrency: currency });
    navigate('import');
  };

  return (
    <div className="flex flex-col gap-4 pb-2">
      <div className="ob-fade-up flex items-center gap-3">
        <AppLogo size={48} />
        <div>
          <h1 className="text-2xl font-bold">{t('onboarding.startTitle')}</h1>
          <p className="text-sm text-muted">{t('onboarding.startText')}</p>
        </div>
      </div>

      <section
        aria-labelledby="first-account"
        className="ob-fade-up flex flex-col gap-4 rounded-2xl bg-surface p-4"
        style={{ animationDelay: '120ms' }}
      >
        <h2 id="first-account" className="flex items-center gap-2 text-lg font-semibold">
          <Wallet size={20} aria-hidden="true" /> {t('onboarding.firstAccount')}
        </h2>
        <Field label={t('onboarding.mainCurrency')}>
          {(id) => (
            <Select id={id} value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {COMMON_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t('onboarding.accountName')}>
          {(id) => <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label={t('account.kind')}>
          {(id) => (
            <Select id={id} value={kind} onChange={(e) => setKind(e.target.value as AccountKind)}>
              {ACCOUNT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(`account.kind.${k}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t('onboarding.balance')} error={error ?? undefined}>
          {(id) => (
            <TextInput
              id={id}
              inputMode="decimal"
              placeholder="0"
              value={balance}
              onChange={(e) => {
                setBalance(e.target.value);
                setError(null);
              }}
            />
          )}
        </Field>
        <Button block onClick={finish}>
          {t('onboarding.create')}
        </Button>
      </section>

      <section
        className="ob-fade-up flex flex-col gap-2 rounded-2xl border border-dashed border-border p-4"
        style={{ animationDelay: '240ms' }}
      >
        <h2 className="flex items-center gap-2 font-semibold">
          <FileUp size={20} aria-hidden="true" /> {t('onboarding.importTitle')}
        </h2>
        <p className="text-sm text-muted">{t('onboarding.importText')}</p>
        <Button variant="secondary" onClick={importInstead}>
          {t('onboarding.importButton')}
        </Button>
      </section>
    </div>
  );
}

/** Просим браузер не очищать IndexedDB при нехватке места. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

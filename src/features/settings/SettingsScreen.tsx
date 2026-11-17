import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Download, HardDrive, Lock, Trash2, Upload } from 'lucide-react';
import { navigate } from '../../app/router';
import { isValidTimeZone } from '../../domain/dates';
import { COMMON_CURRENCIES, numberSeparators } from '../../domain/money';
import type { ThemeSetting } from '../../domain/types';
import { hashPin, isValidPin, newSalt, verifyPin } from '../../security/pin';
import { PinPad } from '../../security/PinPad';
import { useData } from '../../stores/dataStore';
import { useUi } from '../../stores/uiStore';
import { BottomSheet, ConfirmDialog } from '../../ui/BottomSheet';
import {
  Button,
  Card,
  Field,
  SegmentedControl,
  Select,
  TextInput,
  Toggle,
} from '../../ui/controls';
import { Screen } from '../../ui/Screen';
import { notificationsSupported, requestNotificationPermission } from '../recurring/notifications';
import { useT } from '../../i18n';
import { LanguageField } from './LanguageField';

const FALLBACK_ZONES = [
  'Asia/Bishkek',
  'Asia/Almaty',
  'Asia/Tashkent',
  'Asia/Dushanbe',
  'Europe/Moscow',
  'Europe/Istanbul',
  'Asia/Dubai',
  'Europe/London',
  'UTC',
];

function timeZones(current: string): string[] {
  const all =
    typeof Intl.supportedValuesOf === 'function'
      ? Intl.supportedValuesOf('timeZone')
      : FALLBACK_ZONES;
  return all.includes(current) ? all : [current, ...all];
}

export function SettingsScreen() {
  const t = useT();
  const settings = useData((s) => s.settings);
  const updateSettings = useData((s) => s.updateSettings);
  const resetAll = useData((s) => s.resetAll);
  const toast = useUi((s) => s.toast);
  const [pinSheet, setPinSheet] = useState<'set' | 'remove' | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetText, setResetText] = useState('');
  const zones = useMemo(() => timeZones(settings.timeZone), [settings.timeZone]);
  const storage = useStorageInfo();

  const set = (patch: Parameters<typeof updateSettings>[0]) => void updateSettings(patch);

  return (
    <Screen title={t('more.settings')} onBack={() => navigate('more')}>
      <div className="flex flex-col gap-4">
        <Card className="flex flex-col gap-4">
          <LanguageField />
          <Field label={t('settings.currency')} hint={t('settings.currencyHint')}>
            {(id) => (
              <Select
                id={id}
                value={settings.defaultCurrency}
                onChange={(e) => set({ defaultCurrency: e.target.value })}
              >
                {COMMON_CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t('settings.timeZone')} hint={t('settings.timeZoneHint')}>
            {(id) => (
              <Select
                id={id}
                value={settings.timeZone}
                onChange={(e) =>
                  isValidTimeZone(e.target.value) && set({ timeZone: e.target.value })
                }
              >
                {zones.map((z) => (
                  <option key={z}>{z}</option>
                ))}
              </Select>
            )}
          </Field>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-muted">{t('settings.weekStart')}</span>
            <SegmentedControl
              label={t('settings.weekStart')}
              value={String(settings.weekStartsOn) as '0' | '1'}
              options={[
                { value: '1', label: t('settings.monday') },
                { value: '0', label: t('settings.sunday') },
              ]}
              onChange={(v) => set({ weekStartsOn: v === '1' ? 1 : 0 })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-muted">{t('settings.theme')}</span>
            <SegmentedControl<ThemeSetting>
              label={t('settings.theme')}
              value={settings.theme}
              options={[
                { value: 'light', label: t('settings.themeLight') },
                { value: 'dark', label: t('settings.themeDark') },
                { value: 'system', label: t('settings.themeSystem') },
              ]}
              onChange={(theme) => set({ theme })}
            />
          </div>
        </Card>

        <Card className="flex flex-col gap-1">
          <h2 className="flex items-center gap-2 font-semibold">
            <Lock size={18} aria-hidden="true" /> {t('settings.security')}
          </h2>
          <p className="text-sm text-muted">{t('settings.securityHint')}</p>
          <div className="mt-2 flex gap-2">
            {settings.pinHash ? (
              <>
                <Button variant="secondary" onClick={() => setPinSheet('set')}>
                  {t('settings.changePin')}
                </Button>
                <Button variant="danger" onClick={() => setPinSheet('remove')}>
                  {t('settings.disablePin')}
                </Button>
              </>
            ) : (
              <Button variant="secondary" onClick={() => setPinSheet('set')}>
                {t('settings.setPin')}
              </Button>
            )}
          </div>
          {notificationsSupported() && (
            <Toggle
              checked={settings.notificationsEnabled}
              onChange={async (on) => {
                const granted = on ? await requestNotificationPermission() : false;
                await updateSettings({ notificationsEnabled: on && granted });
                if (on && !granted)
                  toast({ text: t('recurring.notificationsDenied'), tone: 'warning' });
              }}
              label={t('settings.notifications')}
            />
          )}
        </Card>

        <Card className="flex flex-col">
          <h2 className="mb-1 font-semibold">{t('settings.data')}</h2>
          <LinkRow
            icon={<Upload size={18} />}
            label={t('more.import')}
            onClick={() => navigate('import')}
          />
          <LinkRow
            icon={<Download size={18} />}
            label={t('more.export')}
            onClick={() => navigate('export')}
          />
          <div className="flex items-start gap-3 py-2 text-sm text-muted">
            <HardDrive size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
            <span>
              {storage.persisted
                ? t('settings.storagePersisted')
                : t('settings.storageNotPersisted')}
              {storage.usageMb !== undefined &&
                ` ${t('settings.storageUsed', {
                  size: storage.usageMb.toFixed(1).replace('.', numberSeparators().decimal),
                })}`}
            </span>
          </div>
          <Button variant="danger" className="justify-start" onClick={() => setConfirmReset(true)}>
            <Trash2 size={18} aria-hidden="true" /> {t('settings.reset')}
          </Button>
        </Card>

        <p className="text-center text-xs text-muted">
          {t('app.name')} {__APP_VERSION__} · {t('settings.footer')}
        </p>
      </div>

      {pinSheet && (
        <PinSheet
          mode={pinSheet}
          onClose={() => setPinSheet(null)}
          onDone={async (patch) => {
            await updateSettings(patch);
            toast({ text: patch.pinHash ? t('settings.pinSet') : t('settings.pinRemoved') });
            setPinSheet(null);
          }}
        />
      )}
      <ConfirmDialog
        open={confirmReset}
        title={t('settings.resetTitle')}
        text={t('settings.resetText', { word: t('lock.confirmWord') })}
        confirmLabel={t('lock.resetConfirm')}
        confirmDisabled={resetText.trim().toUpperCase() !== t('lock.confirmWord')}
        onCancel={() => {
          setConfirmReset(false);
          setResetText('');
        }}
        onConfirm={async () => {
          await resetAll();
          setConfirmReset(false);
          setResetText('');
          navigate('home');
        }}
      >
        <TextInput
          aria-label={t('lock.confirmation')}
          value={resetText}
          onChange={(e) => setResetText(e.target.value)}
        />
      </ConfirmDialog>
    </Screen>
  );
}

function LinkRow({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-12 items-center gap-3 text-left">
      <span aria-hidden="true" className="text-accent">
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      <ChevronRight size={18} className="text-muted" aria-hidden="true" />
    </button>
  );
}

function useStorageInfo(): { persisted: boolean; usageMb?: number } {
  const [info, setInfo] = useState<{ persisted: boolean; usageMb?: number }>({ persisted: false });
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const persisted = (await navigator.storage?.persisted?.()) ?? false;
        const estimate = await navigator.storage?.estimate?.();
        const usageMb = estimate?.usage !== undefined ? estimate.usage / 1024 / 1024 : undefined;
        if (!cancelled) setInfo({ persisted, usageMb });
      } catch {
        // Storage API недоступен — оставляем значения по умолчанию.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return info;
}

function PinSheet({
  mode,
  onClose,
  onDone,
}: {
  mode: 'set' | 'remove';
  onClose: () => void;
  onDone: (patch: { pinHash?: string; pinSalt?: string }) => Promise<void>;
}) {
  const t = useT();
  const settings = useData((s) => s.settings);
  const needsCurrent = !!settings.pinHash;
  const [stage, setStage] = useState<'current' | 'new' | 'repeat'>(
    needsCurrent ? 'current' : 'new',
  );
  const [value, setValue] = useState('');
  const [first, setFirst] = useState('');
  const [error, setError] = useState<string | null>(null);

  const titles = {
    current: t('pin.current'),
    new: t('pin.new'),
    repeat: t('pin.repeat'),
  };

  const submit = async () => {
    setError(null);
    if (stage === 'current') {
      const ok = await verifyPin(value, settings.pinSalt!, settings.pinHash!);
      if (!ok) {
        setValue('');
        return setError(t('lock.wrongPin'));
      }
      if (mode === 'remove') return onDone({ pinHash: undefined, pinSalt: undefined });
      setStage('new');
      setValue('');
    } else if (stage === 'new') {
      if (!isValidPin(value)) return setError(t('pin.invalid'));
      setFirst(value);
      setStage('repeat');
      setValue('');
    } else {
      if (value !== first) {
        setStage('new');
        setValue('');
        return setError(t('pin.mismatch'));
      }
      const salt = newSalt();
      await onDone({ pinSalt: salt, pinHash: await hashPin(value, salt) });
    }
  };

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={mode === 'remove' ? t('pin.disableTitle') : t('pin.title')}
    >
      <div className="flex flex-col items-center gap-4 pb-2">
        <p className="font-medium">{titles[stage]}</p>
        {error && (
          <p role="alert" className="text-sm font-medium text-expense">
            {error}
          </p>
        )}
        <PinPad value={value} onChange={setValue} onSubmit={submit} />
      </div>
    </BottomSheet>
  );
}

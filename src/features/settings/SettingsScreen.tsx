import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Download, HardDrive, Lock, Trash2, Upload } from 'lucide-react';
import { navigate } from '../../app/router';
import { isValidTimeZone } from '../../domain/dates';
import { COMMON_CURRENCIES } from '../../domain/money';
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
    <Screen title="Настройки" onBack={() => navigate('more')}>
      <div className="flex flex-col gap-4">
        <Card className="flex flex-col gap-4">
          <Field label="Валюта по умолчанию" hint="Для итогов, новых счетов и импорта">
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
          <Field label="Часовой пояс" hint="Определяет границы дней, недель и месяцев">
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
            <span className="text-sm font-medium text-muted">Первый день недели</span>
            <SegmentedControl
              label="Первый день недели"
              value={String(settings.weekStartsOn) as '0' | '1'}
              options={[
                { value: '1', label: 'Понедельник' },
                { value: '0', label: 'Воскресенье' },
              ]}
              onChange={(v) => set({ weekStartsOn: v === '1' ? 1 : 0 })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-muted">Тема</span>
            <SegmentedControl<ThemeSetting>
              label="Тема"
              value={settings.theme}
              options={[
                { value: 'light', label: 'Светлая' },
                { value: 'dark', label: 'Тёмная' },
                { value: 'system', label: 'Системная' },
              ]}
              onChange={(theme) => set({ theme })}
            />
          </div>
        </Card>

        <Card className="flex flex-col gap-1">
          <h2 className="flex items-center gap-2 font-semibold">
            <Lock size={18} aria-hidden="true" /> Защита
          </h2>
          <p className="text-sm text-muted">
            PIN-код запрашивается при запуске и после минуты в фоне. Он защищает от случайного
            доступа, но не шифрует данные на устройстве.
          </p>
          <div className="mt-2 flex gap-2">
            {settings.pinHash ? (
              <>
                <Button variant="secondary" onClick={() => setPinSheet('set')}>
                  Сменить PIN
                </Button>
                <Button variant="danger" onClick={() => setPinSheet('remove')}>
                  Отключить
                </Button>
              </>
            ) : (
              <Button variant="secondary" onClick={() => setPinSheet('set')}>
                Установить PIN-код
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
                  toast({ text: 'Браузер не разрешил уведомления', tone: 'warning' });
              }}
              label="Уведомления о регулярных платежах"
            />
          )}
        </Card>

        <Card className="flex flex-col">
          <h2 className="mb-1 font-semibold">Данные</h2>
          <LinkRow icon={<Upload size={18} />} label="Импорт" onClick={() => navigate('import')} />
          <LinkRow
            icon={<Download size={18} />}
            label="Экспорт"
            onClick={() => navigate('export')}
          />
          <div className="flex items-start gap-3 py-2 text-sm text-muted">
            <HardDrive size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
            <span>
              {storage.persisted
                ? 'Браузер обещал не удалять данные автоматически.'
                : 'Браузер может удалить данные при нехватке места. Регулярно делайте экспорт.'}
              {storage.usage && ` Занято: ${storage.usage}.`}
            </span>
          </div>
          <Button variant="danger" className="justify-start" onClick={() => setConfirmReset(true)}>
            <Trash2 size={18} aria-hidden="true" /> Сбросить все данные
          </Button>
        </Card>

        <p className="text-center text-xs text-muted">
          Акчакана {__APP_VERSION__} · данные хранятся только на этом устройстве
        </p>
      </div>

      {pinSheet && (
        <PinSheet
          mode={pinSheet}
          onClose={() => setPinSheet(null)}
          onDone={async (patch) => {
            await updateSettings(patch);
            toast({ text: patch.pinHash ? 'PIN-код установлен' : 'PIN-код отключён' });
            setPinSheet(null);
          }}
        />
      )}
      <ConfirmDialog
        open={confirmReset}
        title="Удалить все данные?"
        text="Будут удалены все счета, операции, категории, бюджеты и настройки на этом устройстве. Отменить нельзя. Введите УДАЛИТЬ для подтверждения."
        confirmLabel="Удалить всё"
        confirmDisabled={resetText.trim().toUpperCase() !== 'УДАЛИТЬ'}
        onCancel={() => {
          setConfirmReset(false);
          setResetText('');
        }}
        onConfirm={async () => {
          await resetAll();
          setConfirmReset(false);
          setResetText('');
          navigate('transactions');
        }}
      >
        <TextInput
          aria-label="Подтверждение"
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

function useStorageInfo(): { persisted: boolean; usage?: string } {
  const [info, setInfo] = useState<{ persisted: boolean; usage?: string }>({ persisted: false });
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const persisted = (await navigator.storage?.persisted?.()) ?? false;
        const estimate = await navigator.storage?.estimate?.();
        const mb = estimate?.usage !== undefined ? (estimate.usage / 1024 / 1024).toFixed(1) : null;
        if (!cancelled)
          setInfo({ persisted, usage: mb ? `${mb.replace('.', ',')} МБ` : undefined });
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
  const settings = useData((s) => s.settings);
  const needsCurrent = !!settings.pinHash;
  const [stage, setStage] = useState<'current' | 'new' | 'repeat'>(
    needsCurrent ? 'current' : 'new',
  );
  const [value, setValue] = useState('');
  const [first, setFirst] = useState('');
  const [error, setError] = useState<string | null>(null);

  const titles = {
    current: 'Текущий PIN-код',
    new: 'Новый PIN-код (4–6 цифр)',
    repeat: 'Повторите PIN-код',
  };

  const submit = async () => {
    setError(null);
    if (stage === 'current') {
      const ok = await verifyPin(value, settings.pinSalt!, settings.pinHash!);
      if (!ok) {
        setValue('');
        return setError('Неверный PIN-код');
      }
      if (mode === 'remove') return onDone({ pinHash: undefined, pinSalt: undefined });
      setStage('new');
      setValue('');
    } else if (stage === 'new') {
      if (!isValidPin(value)) return setError('PIN-код — от 4 до 6 цифр');
      setFirst(value);
      setStage('repeat');
      setValue('');
    } else {
      if (value !== first) {
        setStage('new');
        setValue('');
        return setError('PIN-коды не совпали, введите заново');
      }
      const salt = newSalt();
      await onDone({ pinSalt: salt, pinHash: await hashPin(value, salt) });
    }
  };

  return (
    <BottomSheet open onClose={onClose} title={mode === 'remove' ? 'Отключить PIN-код' : 'PIN-код'}>
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

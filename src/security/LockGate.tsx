import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { useData } from '../stores/dataStore';
import { ConfirmDialog } from '../ui/BottomSheet';
import { TextInput } from '../ui/controls';
import { verifyPin } from './pin';
import { PinPad } from './PinPad';

const LOCK_AFTER_MS = 60_000;

/** Блокирует приложение PIN-кодом при запуске и после минуты в фоне. */
export function LockGate({ children }: { children: ReactNode }) {
  const pinHash = useData((s) => s.settings.pinHash);
  const pinSalt = useData((s) => s.settings.pinSalt);
  const resetAll = useData((s) => s.resetAll);
  const enabled = !!pinHash && !!pinSalt;
  const [locked, setLocked] = useState(enabled);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const hiddenAt = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') hiddenAt.current = Date.now();
      else if (hiddenAt.current && Date.now() - hiddenAt.current > LOCK_AFTER_MS) {
        setLocked(true);
        setPin('');
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [enabled]);

  if (!enabled || !locked) return <>{children}</>;

  const submit = async () => {
    setChecking(true);
    const ok = await verifyPin(pin, pinSalt!, pinHash!);
    setChecking(false);
    if (ok) {
      setLocked(false);
      setPin('');
      setError(null);
    } else {
      setError('Неверный PIN-код');
      setPin('');
    }
  };

  return (
    <div className="pt-safe pb-safe flex min-h-dvh flex-col items-center justify-center gap-6 px-6">
      <Lock size={36} className="text-accent" aria-hidden="true" />
      <h1 className="text-xl font-semibold">Введите PIN-код</h1>
      {error && (
        <p role="alert" className="font-medium text-expense">
          {error}
        </p>
      )}
      <PinPad
        value={pin}
        onChange={(v) => {
          setPin(v);
          setError(null);
        }}
        onSubmit={submit}
        submitLabel={checking ? '…' : 'Войти'}
      />
      <button
        type="button"
        className="min-h-11 px-3 text-sm text-muted underline"
        onClick={() => setForgot(true)}
      >
        Забыли PIN-код?
      </button>
      <ConfirmDialog
        open={forgot}
        title="Сбросить все данные?"
        text="PIN-код нельзя восстановить. Можно только удалить все данные на этом устройстве и начать заново (или затем импортировать резервную копию). Введите УДАЛИТЬ для подтверждения."
        confirmLabel="Удалить всё"
        confirmDisabled={confirmText.trim().toUpperCase() !== 'УДАЛИТЬ'}
        onCancel={() => {
          setForgot(false);
          setConfirmText('');
        }}
        onConfirm={async () => {
          await resetAll();
          setForgot(false);
          setLocked(false);
        }}
      >
        <TextInput
          aria-label="Подтверждение"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
        />
      </ConfirmDialog>
    </div>
  );
}

import { t } from '../i18n';

const CSV_MIME = 'text/csv;charset=utf-8';

/** Обычное скачивание через `<a download>`: файл попадает в «Загрузки». */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const isAbort = (e: unknown) => (e as DOMException | undefined)?.name === 'AbortError';

/**
 * Отдаёт файл пользователю: на телефонах — через системное меню «Поделиться» (Web Share API),
 * иначе — обычным скачиванием.
 */
export async function shareOrDownload(
  content: string,
  fileName: string,
  mime = CSV_MIME,
): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const blob = new Blob([content], { type: mime });
  const file = new File([blob], fileName, { type: mime });
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  if (coarse && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName });
      return 'shared';
    } catch (e) {
      if (isAbort(e)) return 'cancelled';
      // Если поделиться не вышло — скачиваем.
    }
  }
  downloadBlob(blob, fileName);
  return 'downloaded';
}

interface SaveFilePickerWindow {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<{
    createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }>;
  }>;
}

/** Есть ли окно «Сохранить как» (File System Access API: Chrome и Edge на компьютере). */
export function saveDialogSupported(): boolean {
  return typeof (window as SaveFilePickerWindow).showSaveFilePicker === 'function';
}

/** Можно ли передать файл через меню «Поделиться». */
export function fileShareSupported(): boolean {
  try {
    const probe = new File(['x'], 'probe.csv', { type: CSV_MIME });
    return !!navigator.canShare?.({ files: [probe] });
  } catch {
    return false;
  }
}

/**
 * Сохраняет файл туда, куда выберет пользователь. Вызывать только из обработчика нажатия:
 * без жеста браузеры не открывают ни меню «Поделиться», ни окно сохранения.
 * - share: меню «Поделиться» (Google Диск, «Файлы», мессенджеры); если недоступно — как download;
 * - download: окно «Сохранить как», где оно есть, иначе скачивание в «Загрузки».
 */
export async function saveFileAs(
  content: string,
  fileName: string,
  method: 'share' | 'download',
  mime = CSV_MIME,
): Promise<'shared' | 'saved' | 'downloaded' | 'cancelled'> {
  const blob = new Blob([content], { type: mime });
  if (method === 'share') {
    const file = new File([blob], fileName, { type: mime });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: fileName });
        return 'shared';
      } catch (e) {
        if (isAbort(e)) return 'cancelled';
      }
    }
  }
  const picker = (window as SaveFilePickerWindow).showSaveFilePicker;
  if (picker) {
    try {
      const handle = await picker({
        suggestedName: fileName,
        types: [{ description: t('backup.csvType'), accept: { 'text/csv': ['.csv'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return 'saved';
    } catch (e) {
      if (isAbort(e)) return 'cancelled';
      // Окно сохранения не сработало (например, запрещено политикой) — скачиваем.
    }
  }
  downloadBlob(blob, fileName);
  return 'downloaded';
}

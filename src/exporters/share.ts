/**
 * Отдаёт файл пользователю: на телефонах — через системное меню «Поделиться» (Web Share API),
 * иначе — обычным скачиванием.
 */
export async function shareOrDownload(
  content: string,
  fileName: string,
  mime = 'text/csv;charset=utf-8',
): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const blob = new Blob([content], { type: mime });
  const file = new File([blob], fileName, { type: mime });
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  if (coarse && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName });
      return 'shared';
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'cancelled';
      // Если поделиться не вышло — скачиваем.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}

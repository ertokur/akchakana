/**
 * Уведомления через Notification API. Без сервера push-уведомлений они показываются,
 * только когда приложение открыто или его страница ожила в фоне.
 */
export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  return (await Notification.requestPermission()) === 'granted';
}

export async function showNotification(title: string, body: string, tag?: string): Promise<void> {
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) {
      await registration.showNotification(title, { body, tag, icon: '/pwa-192x192.png' });
      return;
    }
    new Notification(title, { body, tag });
  } catch {
    // Некоторые браузеры запрещают new Notification() вне service worker — молча пропускаем.
  }
}

/**
 * PIN-код хранится только как PBKDF2-SHA256 хэш с солью. Это защита от случайного доступа
 * к открытому приложению, а не шифрование: данные в IndexedDB остаются незашифрованными.
 */
const ITERATIONS = 150_000;

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(text: string): Uint8Array {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}

export function isValidPin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

export function newSalt(): string {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  return toBase64(salt);
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: fromBase64(salt) as BufferSource,
      iterations: ITERATIONS,
    },
    key,
    256,
  );
  return toBase64(new Uint8Array(bits));
}

export async function verifyPin(pin: string, salt: string, hash: string): Promise<boolean> {
  const actual = await hashPin(pin, salt);
  // Сравнение без раннего выхода.
  let diff = actual.length ^ hash.length;
  for (let i = 0; i < Math.min(actual.length, hash.length); i++) {
    diff |= actual.charCodeAt(i) ^ hash.charCodeAt(i);
  }
  return diff === 0;
}

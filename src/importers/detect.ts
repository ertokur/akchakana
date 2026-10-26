import { decodeText, type TextEncodingName } from './encoding';
import { isOwnCsv } from './ownCsv';

const SQLITE_MAGIC = 'SQLite format 3\0';

/** SQLite определяется по заголовку файла, а не по имени или расширению. */
export function isSqlite(bytes: Uint8Array): boolean {
  if (bytes.length < 16) return false;
  for (let i = 0; i < 16; i++) {
    if (bytes[i] !== SQLITE_MAGIC.charCodeAt(i)) return false;
  }
  return true;
}

export type DetectedFile =
  | { kind: 'sqlite'; bytes: Uint8Array }
  | { kind: 'own'; text: string; encoding: TextEncodingName }
  | { kind: 'csv'; text: string; encoding: TextEncodingName }
  | { kind: 'unknown'; reason: string };

export function detectFile(bytes: Uint8Array): DetectedFile {
  if (bytes.length === 0) return { kind: 'unknown', reason: 'Файл пустой' };
  if (isSqlite(bytes)) return { kind: 'sqlite', bytes };
  // Нулевые байты в начале — двоичный файл, а не CSV.
  if (bytes.subarray(0, 1024).includes(0)) {
    return { kind: 'unknown', reason: 'Файл не похож ни на резервную копию 1Money, ни на CSV' };
  }
  const { text, encoding } = decodeText(bytes);
  return isOwnCsv(text) ? { kind: 'own', text, encoding } : { kind: 'csv', text, encoding };
}

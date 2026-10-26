export type TextEncodingName = 'utf-8' | 'utf-8-bom' | 'windows-1251';

/** Декодирует текстовый файл: UTF-8 с BOM, UTF-8 или Windows-1251 (если UTF-8 невалиден). */
export function decodeText(bytes: Uint8Array): { text: string; encoding: TextEncodingName } {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { text: new TextDecoder('utf-8').decode(bytes.subarray(3)), encoding: 'utf-8-bom' };
  }
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: 'utf-8' };
  } catch {
    return { text: new TextDecoder('windows-1251').decode(bytes), encoding: 'windows-1251' };
  }
}

/** Символ BOM для UTF-8 (U+FEFF), добавляется в начало экспортируемого CSV. */
export const BOM = String.fromCharCode(0xfeff);

export function stripBom(text: string): string {
  return text.startsWith(BOM) ? text.slice(1) : text;
}

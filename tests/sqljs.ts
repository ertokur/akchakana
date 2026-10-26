import fs from 'node:fs';
import path from 'node:path';
import initSqlJs, { type SqlJsStatic } from 'sql.js';

let instance: Promise<SqlJsStatic> | null = null;

/** sql.js для тестов: wasm читается с диска, без сети. */
export function loadSqlJsForTests(): Promise<SqlJsStatic> {
  const dist = path.resolve(process.cwd(), 'node_modules/sql.js/dist');
  instance ??= initSqlJs({
    locateFile: (file: string) => path.join(dist, file),
    wasmBinary: fs.readFileSync(path.join(dist, 'sql-wasm.wasm')).buffer as ArrayBuffer,
  });
  return instance;
}

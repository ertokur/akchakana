import initSqlJs, { type SqlJsStatic } from 'sql.js';
// wasm лежит в бандле и попадает в precache service worker — импорт работает офлайн.
import wasmUrl from 'sql.js/dist/sql-wasm-browser.wasm?url';

let loading: Promise<SqlJsStatic> | null = null;

export function loadSqlJs(): Promise<SqlJsStatic> {
  loading ??= initSqlJs({ locateFile: () => wasmUrl });
  return loading;
}

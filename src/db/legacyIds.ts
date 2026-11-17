/**
 * Записи, импортированные из резервной копии SQLite в прежних версиях, получали ID вида
 * `<префикс>-tr-<номер>` / `<префикс>-de-<номер>` и источник `<префикс>:tr:<номер>`.
 * Сейчас префикс один — `ext` для ID и `backup` для источника. Функции ниже приводят старые
 * значения к новым; используются миграцией базы (v4) и при чтении старых CSV-файлов.
 */
const LEGACY_ID = /^(?!ext-)[a-z]+-(tr|de)-(\d+)$/;
const LEGACY_EXTERNAL = /^(?!backup:)[a-z]+:(tr|de):(.+)$/;

export function normalizeBackupId(id: string): string {
  const m = LEGACY_ID.exec(id);
  return m ? `ext-${m[1]}-${m[2]}` : id;
}

export function normalizeBackupExternalId(externalId: string): string {
  const m = LEGACY_EXTERNAL.exec(externalId);
  return m ? `backup:${m[1]}:${m[2]}` : externalId;
}

type AnyRecord = Record<string, unknown>;
const REF_FIELDS = ['id', 'accountId', 'toAccountId', 'categoryId', 'parentId'] as const;

/**
 * Копия записи любой таблицы с приведёнными ID, ссылками и источником.
 * Возвращает тот же объект, если менять нечего.
 */
export function normalizeRecord<T extends object>(record: T): T {
  const r = record as AnyRecord;
  let changed = false;
  const next: AnyRecord = { ...r };
  for (const field of REF_FIELDS) {
    const v = r[field];
    if (typeof v === 'string' && normalizeBackupId(v) !== v) {
      next[field] = normalizeBackupId(v);
      changed = true;
    }
  }
  const template = r.template as AnyRecord | undefined;
  if (template && typeof template === 'object') {
    const t = normalizeRecord(template);
    if (t !== template) {
      next.template = t;
      changed = true;
    }
  }
  const source = r.source as { kind?: string; externalId?: string } | undefined;
  if (source && source.kind !== 'csv' && source.kind !== 'backup') {
    next.source = {
      kind: 'backup',
      externalId: normalizeBackupExternalId(String(source.externalId ?? '')),
    };
    changed = true;
  } else if (source?.kind === 'backup' && source.externalId) {
    const ext = normalizeBackupExternalId(source.externalId);
    if (ext !== source.externalId) {
      next.source = { ...source, externalId: ext };
      changed = true;
    }
  }
  return (changed ? next : record) as T;
}

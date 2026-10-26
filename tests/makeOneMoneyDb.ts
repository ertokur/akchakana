import type { SqlJsStatic } from 'sql.js';

/**
 * Маленькая синтетическая база в формате резервной копии 1Money.
 * Все данные выдуманы; реальная копия в тесты и репозиторий не попадает.
 *
 * Снимки (_b_i): 1 и 2 — старые ежедневные, 3 — последний.
 */
export const D = (iso: string) => Date.parse(iso); // даты операций в мс Unix

export function makeOneMoneyDb(SQL: SqlJsStatic, opts: { withBuLink?: boolean } = {}): Uint8Array {
  const withBuLink = opts.withBuLink ?? true;
  const db = new SQL.Database();
  db.run(`
    CREATE TABLE android_metadata (locale TEXT);
    INSERT INTO android_metadata VALUES ('ru_RU');
    CREATE TABLE ba (_id INTEGER PRIMARY KEY, _na TEXT, _da INTEGER);
    INSERT INTO ba VALUES (1, 'Daily backup', 1), (2, 'Daily backup', 2), (3, 'Export', 3);
    CREATE TABLE pa (_id INTEGER PRIMARY KEY, _b_b INTEGER);
    INSERT INTO pa VALUES (1, ${D('2026-01-01T00:00:00+06:00')});
    CREATE TABLE cu (_id INTEGER PRIMARY KEY, _co TEXT);
    CREATE TABLE ta (_id INTEGER PRIMARY KEY, _na TEXT);

    CREATE TABLE de (_id INTEGER, _b_i INTEGER, _na TEXT, _ty INTEGER, _ic INTEGER, _ar INTEGER);
    CREATE TABLE tr (
      _id INTEGER, _b_i INTEGER, _ty INTEGER, _a_i INTEGER, _d_i INTEGER, _da INTEGER,
      _a_m TEXT, _co TEXT, _ta TEXT, _rec INTEGER, _rem INTEGER, _sch INTEGER, _c_f INTEGER
    );
  `);

  // de: счета (_ty = 2 в этой синтетике), категории расхода (_ty = 1), дохода (_ty = 0), служебная строка.
  const de: [number, number, string, number, number, number][] = [];
  for (const snap of [1, 2, 3]) {
    de.push([1, snap, 'Наличные', 2, 10, 0]);
    de.push([2, snap, 'Карта Mbank', 2, 11, 0]);
    de.push([10, snap, 'Продукты', 1, 5, 0]);
    de.push([12, snap, 'Транспорт', 1, 7, 0]);
    de.push([20, snap, 'Зарплата', 0, 30, 0]);
    de.push([99, snap, 'All accounts', 4, 0, 0]);
  }
  // Переименование в последнем снимке: должна победить новая версия.
  de.push([11, 1, 'Кафе (старое имя)', 1, 6, 0]);
  de.push([11, 3, 'Кафе', 1, 6, 0]);
  // Архивная категория есть только в старом снимке — берётся самая свежая версия.
  de.push([13, 1, 'Табак', 1, 8, 1]);
  // Категория без операций, есть в последнем снимке.
  de.push([14, 3, 'Подарки', 1, 9, 0]);
  // Счёт без операций, есть в последнем снимке.
  de.push([3, 3, 'Накопления', 2, 12, 0]);
  const insDe = db.prepare('INSERT INTO de VALUES (?, ?, ?, ?, ?, ?)');
  for (const r of de) insDe.run(r);
  insDe.free();

  type Tr = [number, number, number, number, number | null, number, string, string];
  const tr: Tr[] = [
    // Удалённая операция: есть только в старых снимках.
    [100, 1, 0, 1, 10, D('2026-02-01T10:00:00+06:00'), '999', 'удалена'],
    [100, 2, 0, 1, 10, D('2026-02-01T10:00:00+06:00'), '999', 'удалена'],
  ];
  for (const snap of [2, 3]) {
    tr.push([101, snap, 0, 1, 10, D('2026-03-01T09:30:00+06:00'), '76.75', 'Рынок']);
    tr.push([102, snap, 0, 2, 11, D('2026-03-02T13:00:00+06:00'), '2864.5', '']);
  }
  tr.push(
    // Перевод: _a_i — источник, _d_i — получатель.
    [103, 3, 2, 2, 1, D('2026-03-03T08:00:00+06:00'), '5000', 'Снятие'],
    // Доход.
    [104, 3, 1, 2, 20, D('2026-03-05T00:15:00+06:00'), '120000', 'Аванс'],
    // Возврат: отрицательная сумма у расхода.
    [105, 3, 0, 2, 11, D('2026-03-06T19:45:00+06:00'), '-150.5', 'Возврат за заказ'],
    // Операция по архивной категории.
    [106, 3, 0, 1, 13, D('2026-01-10T12:00:00+06:00'), '300', ''],
    // Сразу после полуночи по Бишкеку — в UTC это ещё предыдущий день.
    [107, 3, 0, 1, 12, D('2026-03-31T00:30:00+06:00'), '40', 'Маршрутка'],
  );
  const insTr = db.prepare('INSERT INTO tr VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, 0, 0, 1)');
  for (const r of tr) insTr.run(r);
  insTr.free();

  if (withBuLink) {
    db.run('CREATE TABLE bu (_id INTEGER, _b_i INTEGER, _d_i INTEGER, _or INTEGER)');
    // Порядок: Транспорт, Кафе, Продукты; в старом снимке был другой.
    db.run(`INSERT INTO bu VALUES
      (1, 1, 10, 0), (2, 1, 12, 1),
      (1, 3, 12, 0), (2, 3, 11, 1), (3, 3, 10, 2), (4, 3, 14, 3), (5, 3, 13, 4)`);
  } else {
    db.run('CREATE TABLE bu (_id INTEGER, _b_i INTEGER, _or INTEGER)');
    db.run('INSERT INTO bu VALUES (5000, 3, 0)');
  }

  const bytes = db.export();
  db.close();
  return bytes;
}

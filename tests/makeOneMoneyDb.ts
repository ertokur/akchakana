import type { SqlJsStatic } from 'sql.js';

/**
 * Маленькая синтетическая база в формате резервной копии 1Money (структура таблиц как в
 * настоящей копии). Все данные выдуманы; реальная копия в тесты и репозиторий не попадает.
 *
 * Снимки (_b_i): 1 — старая установка с английскими категориями и удалённым счётом,
 * 2 — промежуточный ежедневный, 3 — последний («Export»).
 */
export const D = (iso: string) => Date.parse(iso);

/** Цвет в формате Android: знаковое 32-битное ARGB. */
const argb = (hex: string) => 0xff000000 | parseInt(hex.slice(1), 16) | 0;

export function makeOneMoneyDb(SQL: SqlJsStatic, opts: { withBu?: boolean } = {}): Uint8Array {
  const withBu = opts.withBu ?? true;
  const db = new SQL.Database();
  db.run(`
    CREATE TABLE android_metadata (locale TEXT);
    INSERT INTO android_metadata VALUES ('ru_RU');
    CREATE TABLE ba (_id INTEGER PRIMARY KEY AUTOINCREMENT, _na TEXT, _da INTEGER, _ty INTEGER);
    INSERT INTO ba (_na, _da, _ty) VALUES ('Daily backup', 1, 4), ('Daily backup', 2, 4), ('Export', 3, 2);
    CREATE TABLE pa (_b_i INTEGER, _b_p INTEGER, _d_o_w INTEGER, _b_b INTEGER);
    INSERT INTO pa VALUES (3, 2, 2, ${D('2017-01-01T00:00:00+06:00')});
    CREATE TABLE cu (_id INTEGER, _b_i INTEGER, _is TEXT, _sy TEXT, _fr INTEGER, _ro INTEGER);
    CREATE TABLE ta (_id INTEGER, _b_i INTEGER, _or INTEGER, _co INTEGER, _na TEXT);
    CREATE TABLE bs (_bid INTEGER, _b_i INTEGER, _id INTEGER, _mo TEXT);
    CREATE TABLE de (_id INTEGER, _b_i INTEGER, _ty INTEGER, _c_i INTEGER, _ic INTEGER, _co INTEGER,
      _na TEXT, _de TEXT, _ar INTEGER, _a_m_b TEXT, _a_m_l TEXT, _a_m_g TEXT, _a_i_i_b INTEGER,
      _a_i_i_e INTEGER, _a_o INTEGER, _c_i_u_c INTEGER, _c_i_u INTEGER, _pi INTEGER);
    CREATE TABLE tr (_id INTEGER, _id_b INTEGER, _b_i INTEGER, _ty INTEGER, _da INTEGER,
      _rec INTEGER, _rem INTEGER, _sch INTEGER, _cr_i INTEGER, _u_i INTEGER, _a_i INTEGER,
      _d_i INTEGER, _p_id INTEGER, _c_id INTEGER, _a_m TEXT, _d_m TEXT, _c_f TEXT, _co TEXT, _ta TEXT);
  `);

  const insDe = db.prepare(
    `INSERT INTO de (_id, _b_i, _ty, _c_i, _ic, _co, _na, _ar, _a_m_b, _a_o, _c_i_u_c, _pi)
     VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  type De = [
    id: number,
    ty: number,
    ic: number,
    color: string,
    name: string,
    ar: number,
    balance: string | null,
    accOrder: number | null,
    catFlag: number | null,
    parent: number | null,
  ];
  const current: De[] = [
    // Служебная строка.
    [900, 4, 4, '#3f51b5', 'All accounts', 0, null, 2, null, null],
    // Счета: _ty = 0 и начальный баланс в _a_m_b. «Копилка» идёт второй по _a_o.
    [2, 0, 3, '#26a69a', 'Копилка', 0, '779', 1, null, null],
    [1, 0, 4, '#5c6bc0', 'Карта ', 0, '-28.75', 0, null, null],
    // Категории доходов: тоже _ty = 0, но без баланса.
    [20, 0, 132, '#009688', 'Зарплата', 0, null, null, 0, null],
    [21, 0, 1, '#9e9e9e', 'Другое', 0, null, null, 1, null],
    // Категории расходов и подкатегории (_pi).
    [10, 1, 14, '#42a5f5', 'Еда и продукты', 0, null, null, 0, null],
    [11, 1, 15, '#42a5f5', 'Вне дома', 0, null, null, 0, 10],
    [12, 1, 14, '#42a5f5', 'Дома', 1, null, null, 0, 10],
    [13, 1, 17, '#ffab40', 'Транспорт', 0, null, null, 0, null],
    [14, 1, 76, '#ffab40', 'Такси', 0, null, null, 0, 13],
    [15, 1, 24, '#ff5252', 'Подарки', 1, null, null, 0, null],
    [16, 1, 1, '#9e9e9e', 'Другое', 0, null, null, 1, null],
  ];
  // Старая установка: английские категории и удалённый счёт — в последнем снимке их нет.
  const old: De[] = [
    [500, 0, 4, '#5c6bc0', 'Card', 0, null, 0, null, null],
    [501, 1, 14, '#42a5f5', 'Groceries', 0, null, null, 0, null],
    [502, 0, 132, '#009688', 'Salary', 0, null, null, 0, null],
    [503, 0, 3, '#26a69a', 'Наличка', 0, '100', 2, null, null],
  ];
  const put = (snap: number, r: De) =>
    insDe.run([r[0], snap, r[1], r[2], argb(r[3]), r[4], r[5], r[6], r[7], r[8], r[9]]);
  for (const r of old) put(1, r);
  for (const r of current) put(2, r);
  // В последнем снимке «Транспорт» переименован — должна победить новая версия.
  for (const r of current)
    put(3, r[0] === 13 ? [13, 1, 17, '#ffab40', 'Транспорт и такси', 0, null, null, 0, null] : r);
  insDe.free();

  const insTr = db.prepare(
    `INSERT INTO tr (_id, _b_i, _ty, _da, _rec, _rem, _sch, _cr_i, _u_i, _a_i, _d_i, _a_m, _d_m, _c_f, _co)
     VALUES (?, ?, ?, ?, 0, 0, 0, 0, 0, ?, ?, ?, ?, '1', ?)`,
  );
  type Tr = [
    id: number,
    ty: number,
    iso: string,
    from: number,
    to: number,
    amount: string,
    note: string | null,
  ];
  const ops: Tr[] = [
    [101, 0, '2026-03-01T09:30:00+06:00', 1, 10, '76.75', 'Рынок'],
    [102, 0, '2026-03-02T13:00:00+06:00', 1, 11, '2864.5', null],
    [103, 2, '2026-03-03T08:00:00+06:00', 2, 1, '50', 'В копилку обратно'],
    [104, 1, '2026-03-05T00:15:00+06:00', 1, 20, '1200', 'Аванс'],
    [105, 1, '2026-03-06T19:45:00+06:00', 1, 21, '-150.5', 'Возврат'],
    [106, 0, '2026-01-10T12:00:00+06:00', 1, 15, '30', null],
    [107, 0, '2026-03-31T00:30:00+06:00', 2, 14, '40', 'Такси'],
    [108, 2, '2026-03-07T10:00:00+06:00', 1, 2, '10', null],
  ];
  // Удалённая операция есть только в старом снимке.
  insTr.run([100, 2, 0, D('2026-02-01T10:00:00+06:00'), 1, 10, '999', '999', 'удалена']);
  for (const snap of [2, 3]) {
    for (const [id, ty, iso, from, to, amount, note] of ops) {
      if (snap === 2 && id > 104) continue;
      insTr.run([id, snap, ty, D(iso), from, to, amount, amount, note]);
    }
  }
  insTr.free();

  if (withBu) {
    db.run('CREATE TABLE bu (_id INTEGER, _b_i INTEGER, _or INTEGER, _mo TEXT)');
    // Порядок в последнем снимке: Транспорт, Еда, Другое; у подкатегорий и счетов — NULL.
    db.run(`INSERT INTO bu VALUES
      (10, 1, 0, NULL), (13, 1, 1, NULL), (501, 1, 2, NULL),
      (13, 3, 0, NULL), (10, 3, 1, NULL), (16, 3, 2, NULL), (15, 3, NULL, NULL),
      (11, 3, NULL, NULL), (12, 3, NULL, NULL), (14, 3, NULL, NULL), (1, 3, NULL, NULL),
      (20, 3, 0, NULL), (21, 3, 1, NULL)`);
  }

  const bytes = db.export();
  db.close();
  return bytes;
}

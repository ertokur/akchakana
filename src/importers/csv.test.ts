import { makeAccount, defaultCategories } from '../db/seed';
import { dayKey } from '../domain/dates';
import type { Account, Budget, Category, Debt, RecurringRule, Transaction } from '../domain/types';
import { buildOwnCsv, filterExport, type ExportData } from '../exporters/ownCsv';
import { applyImportPlan } from './apply';
import {
  analyzeCsv,
  detectDateFormat,
  guessMapping,
  parseCsv,
  parseCsvDate,
  type CsvImportOptions,
} from './csvGeneric';
import { detectFile } from './detect';
import { BOM, decodeText } from './encoding';
import { isOwnCsv, parseOwnCsv } from './ownCsv';
import { makeTx, setupTestRepos } from '../../tests/helpers';

const TZ = 'Asia/Bishkek';

/** Кодирует строку в Windows-1251 (только кириллица и ASCII — для теста достаточно). */
function encode1251(text: string): Uint8Array {
  return Uint8Array.from(
    [...text].map((ch) => {
      const code = ch.charCodeAt(0);
      if (code < 0x80) return code;
      if (code >= 0x410 && code <= 0x44f) return code - 0x410 + 0xc0;
      if (code === 0x401) return 0xa8;
      if (code === 0x451) return 0xb8;
      throw new Error(`нет в cp1251: ${ch}`);
    }),
  );
}

describe('кодировки и разделители', () => {
  const text = 'Дата;Сумма;Категория\n01.03.2026;-150,50;Продукты\n';

  it('UTF-8 с BOM', () => {
    const bytes = new TextEncoder().encode(BOM + text);
    expect(decodeText(bytes)).toEqual({ text, encoding: 'utf-8-bom' });
  });

  it('Windows-1251', () => {
    expect(decodeText(encode1251(text))).toEqual({ text, encoding: 'windows-1251' });
    const detected = detectFile(encode1251(text));
    expect(detected).toMatchObject({ kind: 'csv', encoding: 'windows-1251' });
  });

  it('разделители «;» и «,»', () => {
    expect(parseCsv(text).delimiter).toBe(';');
    const comma = parseCsv('date,amount,note\n2026-03-01,"1,5",x\n');
    expect(comma.delimiter).toBe(',');
    expect(comma.rows[0]).toEqual(['2026-03-01', '1,5', 'x']);
  });
});

describe('даты', () => {
  it.each([
    ['01.03.2026', 'dd.MM.yyyy', '2026-03-01'],
    ['2026-03-01', 'yyyy-MM-dd', '2026-03-01'],
    ['01/03/2026', 'dd/MM/yyyy', '2026-03-01'],
    ['01.03.2026 00:30', 'dd.MM.yyyy', '2026-03-01'],
    ['2026-03-01T23:59:59', 'yyyy-MM-dd', '2026-03-01'],
  ] as const)('%s (%s)', (value, format, day) => {
    const ts = parseCsvDate(value, format, TZ)!;
    expect(dayKey(ts, TZ)).toBe(day);
  });

  it('время трактуется в поясе пользователя', () => {
    expect(parseCsvDate('01.03.2026 00:30', 'dd.MM.yyyy', TZ)).toBe(
      Date.parse('2026-02-28T18:30:00Z'),
    );
  });

  it('определяет формат по первым строкам', () => {
    expect(detectDateFormat(['31.01.2026', '01.02.2026'])).toBe('dd.MM.yyyy');
    expect(detectDateFormat(['2026-01-31'])).toBe('yyyy-MM-dd');
    expect(detectDateFormat(['31/01/2026'])).toBe('dd/MM/yyyy');
    expect(detectDateFormat(['вчера'])).toBeNull();
  });
});

describe('универсальный CSV', () => {
  const cash = makeAccount({ id: 'cash', name: 'Наличные', currency: 'KGS' });
  const categories = defaultCategories(0);
  const food = categories.find((c) => c.name === 'Продукты')!;
  const csvText = [
    'Дата;Сумма;Валюта;Счёт;Категория;Комментарий',
    '01.03.2026 10:00;-150,50;KGS;Наличные;Продукты;Рынок',
    '02.03.2026;1 200,00;KGS;Карта;Зарплата;Аванс',
    '03.03.2026;-50;KGS;Наличные;Кино;',
    '32.03.2026;-1;KGS;Наличные;Продукты;плохая дата',
    '04.03.2026;abc;KGS;Наличные;Продукты;плохая сумма',
    '01.03.2026 10:00;-150,50;KGS;Наличные;Продукты;Рынок',
    '05.03.2026;-10;USD;Наличные;Продукты;чужая валюта',
  ].join('\n');
  const parsed = parseCsv(csvText);
  const base: CsvImportOptions = {
    mapping: guessMapping(parsed.headers),
    dateFormat: 'dd.MM.yyyy',
    timeZone: TZ,
    defaultCurrency: 'KGS',
    createAccounts: new Set(),
    createCategories: new Set(),
    includeDuplicates: false,
    now: 1,
  };

  it('сопоставляет колонки по названиям', () => {
    expect(base.mapping).toEqual(['date', 'amount', 'currency', 'account', 'category', 'note']);
    expect(guessMapping(['Date', 'Amount', 'Account', 'To account', 'Type', 'x'])).toEqual([
      'date',
      'amount',
      'account',
      'toAccount',
      'type',
      'ignore',
    ]);
  });

  it('находит отсутствующие счета и категории', () => {
    const { missingAccounts, missingCategories } = analyzeCsv(parsed, base, {
      accounts: [cash],
      categories,
      transactions: [],
    });
    expect(missingAccounts).toEqual(['Карта']);
    expect(missingCategories).toEqual([{ name: 'Кино', kind: 'expense' }]);
  });

  it('создаёт разрешённые, отчитывается об ошибках по строкам, пропускает дубликаты', () => {
    const { plan } = analyzeCsv(
      parsed,
      { ...base, createAccounts: new Set(['Карта']), createCategories: new Set(['expense|Кино']) },
      {
        accounts: [cash],
        categories,
        transactions: [],
      },
    );
    expect(plan.accounts.map((a) => [a.name, a.kind])).toEqual([['Карта', 'card']]);
    expect(plan.categories.map((c) => c.name)).toEqual(['Кино']);
    expect(plan.transactions).toHaveLength(3);
    expect(plan.transactions[0]).toMatchObject({
      type: 'expense',
      amount: 15050,
      accountId: 'cash',
      categoryId: food.id,
      note: 'Рынок',
    });
    expect(plan.transactions[1]).toMatchObject({ type: 'income', amount: 120000 });
    expect(plan.duplicates).toHaveLength(1);
    expect(plan.errors.map((e) => e.row)).toEqual([5, 6, 8]);
    expect(plan.errors[0].message).toMatch(/дата/);
    expect(plan.errors[1].message).toMatch(/сумма/);
    expect(plan.errors[2].message).toMatch(/валюта/);
  });

  it('помечает дубликаты существующих операций', () => {
    const existing = makeTx({
      accountId: 'cash',
      amount: 15050,
      note: 'Рынок',
      date: parseCsvDate('01.03.2026 10:00', 'dd.MM.yyyy', TZ)!,
    });
    const { plan } = analyzeCsv(parsed, base, {
      accounts: [cash],
      categories,
      transactions: [existing],
    });
    expect(plan.duplicates).toHaveLength(2);
    const withDup = analyzeCsv(
      parsed,
      { ...base, includeDuplicates: true },
      {
        accounts: [cash],
        categories,
        transactions: [existing],
      },
    );
    expect(withDup.plan.duplicates).toHaveLength(0);
  });

  it('тип из колонки и переводы', () => {
    const text =
      'date,amount,account,to account,type\n2026-03-01,500,Наличные,Карта,перевод\n2026-03-02,-70,Наличные,,расход\n';
    const p = parseCsv(text);
    const card = makeAccount({ id: 'card', name: 'Карта', currency: 'KGS' });
    const { plan } = analyzeCsv(
      p,
      { ...base, mapping: guessMapping(p.headers), dateFormat: 'yyyy-MM-dd' },
      { accounts: [cash, card], categories, transactions: [] },
    );
    expect(plan.errors).toEqual([]);
    expect(plan.transactions[0]).toMatchObject({
      type: 'transfer',
      accountId: 'cash',
      toAccountId: 'card',
      amount: 50000,
    });
    expect(plan.transactions[1]).toMatchObject({ type: 'expense', amount: 7000 });
  });
});

describe('собственный формат и круговой тест', () => {
  function sampleData(): ExportData {
    const t0 = Date.parse('2026-03-01T04:00:00.123Z');
    const accounts: Account[] = [
      makeAccount(
        {
          id: 'a1',
          name: 'Наличные; «кошелёк»',
          currency: 'KGS',
          initialBalance: 100050,
          order: 0,
        },
        t0,
      ),
      makeAccount(
        { id: 'a2', name: 'Карта', kind: 'card', currency: 'KGS', order: 1, archived: true },
        t0,
      ),
      makeAccount(
        {
          id: 'a3',
          name: 'Доллары',
          kind: 'credit',
          currency: 'USD',
          creditLimit: 50000,
          order: 2,
        },
        t0,
      ),
      makeAccount(
        {
          id: 'a4',
          name: 'Иены',
          currency: 'JPY',
          initialBalance: 1500,
          order: 3,
          source: { kind: 'onemoney', externalId: 'onemoney:de:4' },
        },
        t0,
      ),
    ];
    const categories: Category[] = [
      {
        id: 'c1',
        name: 'Еда',
        kind: 'expense',
        color: '#047857',
        icon: 'cart',
        archived: false,
        order: 0,
        createdAt: t0,
        updatedAt: t0,
      },
      {
        id: 'c2',
        name: 'Кафе, бары',
        kind: 'expense',
        parentId: 'c1',
        color: '#c2410c',
        icon: 'utensils',
        archived: true,
        order: 0,
        createdAt: t0,
        updatedAt: t0 + 5,
      },
      {
        id: 'c3',
        name: 'Зарплата',
        kind: 'income',
        color: '#1d4ed8',
        icon: 'briefcase',
        archived: false,
        order: 0,
        createdAt: t0,
        updatedAt: t0,
      },
    ];
    const transactions: Transaction[] = [
      makeTx({
        id: 't1',
        type: 'expense',
        accountId: 'a1',
        categoryId: 'c2',
        amount: 7675,
        currency: 'KGS',
        date: t0,
        note: 'Многострочная\nзаметка; с "кавычками"',
        tags: ['еда', 'друзья'],
        createdAt: t0,
        updatedAt: t0,
      }),
      makeTx({
        id: 't2',
        type: 'income',
        accountId: 'a2',
        categoryId: 'c3',
        amount: 12000000,
        currency: 'KGS',
        date: t0 + 1000,
        createdAt: t0,
        updatedAt: t0,
      }),
      makeTx({
        id: 't3',
        type: 'transfer',
        accountId: 'a2',
        toAccountId: 'a3',
        amount: 870000,
        toAmount: 10000,
        currency: 'KGS',
        date: t0 + 2000,
        createdAt: t0,
        updatedAt: t0,
      }),
      makeTx({
        id: 't4',
        type: 'expense',
        accountId: 'a1',
        categoryId: 'c1',
        amount: -15050,
        isRefund: true,
        currency: 'KGS',
        date: t0 + 3000,
        createdAt: t0,
        updatedAt: t0,
        source: { kind: 'onemoney', externalId: 'onemoney:tr:105' },
      }),
      makeTx({
        id: 't5',
        type: 'expense',
        accountId: 'a4',
        amount: 1500,
        currency: 'JPY',
        date: Date.parse('2025-12-31T18:30:00Z'),
        createdAt: t0,
        updatedAt: t0,
      }),
    ];
    const budgets: Budget[] = [
      {
        id: 'b1',
        categoryId: null,
        period: 'month',
        limit: 5000000,
        currency: 'KGS',
        startMonth: '2026-01',
        createdAt: t0,
        updatedAt: t0,
      },
      {
        id: 'b2',
        categoryId: 'c1',
        period: 'month',
        limit: 1500050,
        currency: 'KGS',
        startMonth: '2026-03',
        createdAt: t0,
        updatedAt: t0,
      },
    ];
    const debts: Debt[] = [
      {
        id: 'd1',
        direction: 'owedToMe',
        person: 'Азамат',
        amount: 100000,
        currency: 'KGS',
        note: 'до зарплаты',
        settled: false,
        payments: [{ date: t0, amount: 30000 }],
        dueDate: t0 + 86400000,
        createdAt: t0,
        updatedAt: t0,
      },
      {
        id: 'd2',
        direction: 'iOwe',
        person: 'Банк',
        amount: 1000,
        currency: 'USD',
        accountId: 'a3',
        note: '',
        settled: true,
        payments: [],
        createdAt: t0,
        updatedAt: t0,
      },
    ];
    const recurring: RecurringRule[] = [
      {
        id: 'r1',
        name: 'Интернет',
        template: {
          type: 'expense',
          accountId: 'a1',
          categoryId: 'c1',
          amount: 90000,
          currency: 'KGS',
          note: '',
          tags: ['связь'],
        },
        freq: 'month',
        interval: 1,
        startDate: t0,
        nextDate: t0 + 30 * 86400000,
        mode: 'remind',
        active: true,
        lastNotifiedAt: t0,
        createdAt: t0,
        updatedAt: t0,
      },
      {
        id: 'r2',
        name: 'В копилку',
        template: {
          type: 'transfer',
          accountId: 'a2',
          toAccountId: 'a3',
          amount: 870000,
          toAmount: 10000,
          currency: 'KGS',
          note: 'план',
          tags: [],
        },
        freq: 'week',
        interval: 2,
        startDate: t0,
        nextDate: t0,
        endDate: t0 + 365 * 86400000,
        mode: 'auto',
        active: false,
        createdAt: t0,
        updatedAt: t0,
      },
    ];
    return { accounts, categories, transactions, budgets, recurring, debts };
  }

  it('экспорт: BOM, «;», заголовки на русском, колонка типа записи', () => {
    const csv = buildOwnCsv(sampleData(), TZ);
    expect(csv.startsWith(BOM)).toBe(true);
    const header = csv.slice(1).split('\r\n')[0];
    expect(header.split(';').slice(0, 6)).toEqual([
      'Тип записи',
      'ID',
      'Название',
      'Вид',
      'Дата',
      'Сумма',
    ]);
    expect(isOwnCsv(csv)).toBe(true);
    expect(csv).toContain('операция;t2;;доход;2026-03-01T10:00:01.123+06:00;120000,00;KGS;a2');
    expect(csv).toContain(';-150,50;');
  });

  it('экспорт → импорт даёт идентичные данные', () => {
    const data = sampleData();
    const plan = parseOwnCsv(buildOwnCsv(data, TZ));
    expect(plan.errors).toEqual([]);
    expect(plan.warnings).toEqual([]);
    const byId = <T extends { id: string }>(xs: T[]) =>
      [...xs].sort((a, b) => a.id.localeCompare(b.id));
    expect(byId(plan.accounts)).toEqual(byId(data.accounts));
    expect(byId(plan.categories)).toEqual(byId(data.categories));
    expect(byId(plan.transactions)).toEqual(byId(data.transactions));
    expect(byId(plan.budgets)).toEqual(byId(data.budgets));
    expect(byId(plan.debts)).toEqual(byId(data.debts));
    expect(byId(plan.recurring)).toEqual(byId(data.recurring));
  });

  it('круговой тест через базу: экспорт, очистка, импорт файла', async () => {
    const { repos } = await setupTestRepos();
    const data = sampleData();
    await applyImportPlan(
      { format: 'own', ...data, duplicates: [], warnings: [], errors: [] },
      repos,
    );
    const snapshot = async () => ({
      accounts: await repos.accounts.getAll(),
      categories: await repos.categories.getAll(),
      transactions: await repos.transactions.getAll(),
      budgets: await repos.budgets.getAll(),
      recurring: await repos.recurring.getAll(),
      debts: await repos.debts.getAll(),
    });
    const before = await snapshot();
    const file = buildOwnCsv(before, TZ);
    await repos.clearAll();
    const detected = detectFile(new TextEncoder().encode(file));
    expect(detected.kind).toBe('own');
    await applyImportPlan(parseOwnCsv(file), repos);
    expect(await snapshot()).toEqual(before);
    // И второй экспорт байт в байт совпадает с первым.
    expect(buildOwnCsv(await snapshot(), TZ)).toBe(file);
  });

  it('фильтр экспорта по периоду и счетам', () => {
    const data = sampleData();
    const t0 = Date.parse('2026-03-01T04:00:00.123Z');
    const filtered = filterExport(data, { from: t0 + 1000, to: t0 + 3000, accountIds: ['a3'] });
    expect(filtered.transactions.map((t) => t.id)).toEqual(['t3']);
    expect(filtered.accounts).toHaveLength(4);
    expect(filtered.categories).toHaveLength(3);
  });

  it('отчёт об ошибках в собственном формате', () => {
    const csv = buildOwnCsv(sampleData(), TZ).replace(';120000,00;', ';12x;');
    const plan = parseOwnCsv(csv);
    expect(plan.errors).toHaveLength(1);
    expect(plan.errors[0].message).toMatch(/неверная сумма/);
    expect(plan.transactions).toHaveLength(4);
  });
});

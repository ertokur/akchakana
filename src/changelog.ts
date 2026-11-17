/**
 * Список изменений, показывается в «Настройки → Что нового».
 *
 * Правило публикации: каждый деплой — новая версия. Перед пушем в main поднимите `version`
 * в package.json и добавьте запись сюда (новые — сверху). Тест `changelog.test.ts` и проверка
 * в GitHub Actions не дадут опубликовать версию без записи или повторно.
 */
export interface ChangelogEntry {
  version: string;
  /** Дата публикации, `yyyy-MM-dd`. */
  date: string;
  changes: { ru: string[]; en: string[] };
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.3.1',
    date: '2026-11-17',
    changes: {
      ru: ['Обновлены инструменты сборки и публикации приложения.'],
      en: ['Updated the tools used to build and publish the app.'],
    },
  },
  {
    version: '0.3.0',
    date: '2026-11-17',
    changes: {
      ru: [
        'Период «Всё время» в переключателе периода и карточка итогов за всё время в «Обзоре» (с учётом выбранного счёта, по каждой валюте отдельно).',
        'Исправлено: после импорта данных было видно только операции текущего месяца — теперь сразу включается «Всё время» и видна вся история.',
        'Скрытые категории с операциями за период остаются на экране «Категории», чтобы сумма в круге сходилась.',
        'Долги: подписи итогов переведены, остаток показан «из» суммы долга, просроченные выделены, у закрытых — сумма долга вместо нуля, длинные суммы и сроки не обрезаются.',
        'Новое приложение начинается с короткого набора категорий: пять категорий расходов и «Зарплата».',
        'Свайп влево и вправо переключает вкладки нижнего меню с лёгкой анимацией.',
      ],
      en: [
        '"All time" in the period switcher and an all-time totals card in Overview (respects the selected account, one line per currency).',
        'Fixed: after a data import only the current month was visible — now "All time" is switched on and the whole history is shown.',
        'Hidden categories with transactions in the period stay on the Categories screen, so the ring total adds up.',
        'Debts: total labels are translated, the remainder is shown "of" the full amount, overdue debts are highlighted, settled ones show the amount instead of zero, long amounts and dates are no longer cut off.',
        'A new app starts with a short set of categories: five expense categories and "Salary".',
        'Swipe left or right to switch between the bottom tabs, with a light animation.',
      ],
    },
  },
  {
    version: '0.2.0',
    date: '2026-11-17',
    changes: {
      ru: [
        'Новый главный экран «Категории»: круг расходов за период, вокруг — категории с суммами и прогрессом бюджета.',
        'Вкладки Счета, Категории, Операции, Обзор и Ещё; шапка с выбором счёта и балансом.',
        'Шторка операции «Со счёта → В категорию»; подкатегория выбирается строкой значков.',
        'Стандартные подкатегории и их редактор в карточке категории; меньше категорий по умолчанию.',
        'На экране «Счета» — доходы за период и кнопка перевода.',
        'Импорт данных переделан: начальные балансы счетов, подкатегории, цвета и порядок переносятся, удалённые записи не попадают.',
        'Автосохранение резервных копий по расписанию и раздел настроек для него.',
        'Знакомство с приложением в несколько шагов и новый анимированный логотип.',
        'Палитра «Индиго» для светлой и тёмной темы, новые иконки приложения.',
        'Английский язык интерфейса и выбор языка; по умолчанию — язык системы.',
        'Список изменений во вкладке «Ещё» и номер версии.',
        'Исправлено: Escape во вложенной шторке закрывал и основную.',
      ],
      en: [
        'New "Categories" home screen: a spending ring for the period with categories around it, showing amounts and budget progress.',
        'Tabs: Accounts, Categories, Transactions, Overview and More; header with account picker and balance.',
        'Transaction sheet "From account → To category"; pick a subcategory from a row of icons.',
        'Default subcategories and a subcategory editor in the category card; fewer default categories.',
        'The Accounts screen shows income for the period and a transfer button.',
        'Data import reworked: opening balances, subcategories, colors and order are imported; deleted records are skipped.',
        'Scheduled automatic backups with their own settings section.',
        'Multi-step introduction to the app and a new animated logo.',
        'Indigo color palette for light and dark themes, new app icons.',
        'English interface and a language setting; the system language is used by default.',
        'Changelog and version number in the More tab.',
        'Fixed: Escape in a nested sheet also closed the main one.',
      ],
    },
  },
  {
    version: '0.1.0',
    date: '2026-10-27',
    changes: {
      ru: [
        'Первая версия: учёт расходов, доходов и переводов с калькулятором при вводе суммы.',
        'Операции по дням с итогами, периоды день / неделя / месяц / год / свой.',
        'Счета, долги, категории с подкатегориями, скрытием и порядком.',
        'Обзор: диаграмма по категориям, столбцы по дням и месяцам, сравнение с прошлым периодом.',
        'Месячные бюджеты и регулярные платежи с напоминаниями.',
        'Импорт резервной копии и CSV, экспорт всех данных в CSV.',
        'Настройки: валюта, часовой пояс, тема, PIN-код; работа без интернета и установка на телефон.',
      ],
      en: [
        'First release: track expenses, income and transfers with a calculator keypad.',
        'Transactions grouped by day with totals; day / week / month / year / custom periods.',
        'Accounts, debts, categories with subcategories, hiding and ordering.',
        'Overview: category chart, daily and monthly bars, comparison with the previous period.',
        'Monthly budgets and recurring payments with reminders.',
        'Backup and CSV import, export of all data to CSV.',
        'Settings: currency, time zone, theme, PIN code; works offline and installs on a phone.',
      ],
    },
  },
];

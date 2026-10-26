import type { AccountKind } from '../domain/types';

/** Подбор иконки категории по названию — когда в источнике нет понятной нам иконки. */
const ICON_RULES: [RegExp, string][] = [
  [/продукт|еда|супермаркет|grocer|food/i, 'cart'],
  [/кафе|ресторан|обед|кофе|cafe|restaurant/i, 'utensils'],
  [/такси|taxi/i, 'taxi'],
  [/транспорт|автобус|метро|проезд|transport/i, 'bus'],
  [/бензин|топливо|азс|fuel/i, 'fuel'],
  [/авто|машин|car/i, 'car'],
  [/квартир|аренд|жиль|жкх|коммунал|home|rent/i, 'home'],
  [/связь|телефон|мобил|phone/i, 'phone'],
  [/интернет|internet|wi-?fi/i, 'wifi'],
  [/здоров|аптек|врач|медиц|health|pharm/i, 'heart-pulse'],
  [/спорт|фитнес|sport|gym/i, 'dumbbell'],
  [/одежд|обув|cloth/i, 'shirt'],
  [/развлеч|кино|игр|entertain/i, 'gamepad'],
  [/подар|gift/i, 'gift'],
  [/образ|учеб|курс|educat/i, 'graduation'],
  [/дет|ребен|kid|child/i, 'baby'],
  [/путешеств|отпуск|travel/i, 'plane'],
  [/подписк|subscri/i, 'repeat'],
  [/красот|салон|парикмах|beauty/i, 'scissors'],
  [/животн|питом|pet/i, 'paw'],
  [/зарплат|оклад|salary/i, 'briefcase'],
  [/подработ|фриланс|freelance/i, 'laptop'],
  [/процент|депозит|interest/i, 'percent'],
  [/возврат|кэшбэк|cashback|refund/i, 'undo'],
];

export function guessCategoryIcon(name: string, fallback = 'tag'): string {
  return ICON_RULES.find(([re]) => re.test(name))?.[1] ?? fallback;
}

export function guessAccountKind(name: string): AccountKind {
  if (/кредит|credit/i.test(name)) return 'credit';
  if (/накоп|депозит|вклад|сбереж|saving|deposit/i.test(name)) return 'savings';
  if (/карт|card|visa|master|элкарт|банк|bank/i.test(name)) return 'card';
  return 'cash';
}

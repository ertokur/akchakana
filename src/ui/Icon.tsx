import {
  ArrowLeftRight,
  Baby,
  Banknote,
  Bike,
  Book,
  Briefcase,
  Bus,
  Car,
  CarTaxiFront,
  CircleDollarSign,
  Coffee,
  CreditCard,
  Droplet,
  Dumbbell,
  Ellipsis,
  Film,
  Flame,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  Hammer,
  HandCoins,
  HeartPulse,
  House,
  Landmark,
  Laptop,
  Music,
  PawPrint,
  Percent,
  Phone,
  PiggyBank,
  Pill,
  Plane,
  Receipt,
  Repeat,
  Scissors,
  Shirt,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Tag,
  TrainFront,
  TrendingDown,
  TrendingUp,
  Tv,
  Undo2,
  Utensils,
  Wallet,
  Wifi,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/** Набор иконок для счетов и категорий. Ключи хранятся в данных, компоненты — только здесь. */
export const ICONS: Record<string, LucideIcon> = {
  cart: ShoppingCart,
  utensils: Utensils,
  coffee: Coffee,
  bus: Bus,
  train: TrainFront,
  taxi: CarTaxiFront,
  car: Car,
  fuel: Fuel,
  bike: Bike,
  home: House,
  wifi: Wifi,
  phone: Phone,
  smartphone: Smartphone,
  zap: Zap,
  droplet: Droplet,
  flame: Flame,
  'heart-pulse': HeartPulse,
  pill: Pill,
  dumbbell: Dumbbell,
  shirt: Shirt,
  scissors: Scissors,
  gamepad: Gamepad2,
  film: Film,
  music: Music,
  tv: Tv,
  book: Book,
  graduation: GraduationCap,
  gift: Gift,
  sparkles: Sparkles,
  baby: Baby,
  paw: PawPrint,
  plane: Plane,
  repeat: Repeat,
  receipt: Receipt,
  hammer: Hammer,
  tag: Tag,
  briefcase: Briefcase,
  laptop: Laptop,
  percent: Percent,
  undo: Undo2,
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,
  'hand-coins': HandCoins,
  dollar: CircleDollarSign,
  banknote: Banknote,
  'credit-card': CreditCard,
  'piggy-bank': PiggyBank,
  landmark: Landmark,
  wallet: Wallet,
  transfer: ArrowLeftRight,
  dots: Ellipsis,
};

export const ICON_KEYS = Object.keys(ICONS);
export const DEFAULT_ICON = 'tag';

export function Icon({
  name,
  size = 20,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const Component = ICONS[name] ?? ICONS[DEFAULT_ICON];
  return <Component size={size} className={className} aria-hidden="true" />;
}

/** Цветной кружок с иконкой — для категорий и счетов. */
export function IconBadge({
  name,
  color,
  size = 40,
  muted = false,
}: {
  name: string;
  color: string;
  size?: number;
  muted?: boolean;
}) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full text-white"
      style={{ width: size, height: size, background: color, opacity: muted ? 0.55 : 1 }}
    >
      <Icon name={name} size={Math.round(size * 0.5)} />
    </span>
  );
}

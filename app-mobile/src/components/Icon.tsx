// Set de iconos de la app, construido sobre lucide-react-native.
// La API (<Icon name="car" color size />) se mantiene 1:1 con el set anterior
// del handoff, así que las pantallas no cambian.
//
// IMPORTANTE: se importa icono por icono desde 'lucide-react-native/icons/<kebab>'.
// Metro no hace tree-shaking del barrel: importar desde la raíz del paquete mete
// los ~1600 iconos en el bundle (+1.9 MB medidos). Para usar un icono que no esté
// en este set, impórtalo igual: import Wrench from 'lucide-react-native/icons/wrench'.
import React from 'react';
import ArrowRight from 'lucide-react-native/icons/arrow-right';
import Barrel from 'lucide-react-native/icons/barrel';
import Bell from 'lucide-react-native/icons/bell';
import Calendar from 'lucide-react-native/icons/calendar';
import Car from 'lucide-react-native/icons/car';
import Check from 'lucide-react-native/icons/check';
import CircleQuestionMark from 'lucide-react-native/icons/circle-question-mark';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Droplet from 'lucide-react-native/icons/droplet';
import Eye from 'lucide-react-native/icons/eye';
import EyeOff from 'lucide-react-native/icons/eye-off';
import Flag from 'lucide-react-native/icons/flag';
import Gauge from 'lucide-react-native/icons/gauge';
import GripVertical from 'lucide-react-native/icons/grip-vertical';
import House from 'lucide-react-native/icons/house';
import LogOut from 'lucide-react-native/icons/log-out';
import Mail from 'lucide-react-native/icons/mail';
import Menu from 'lucide-react-native/icons/menu';
import Motorbike from 'lucide-react-native/icons/motorbike';
import Plus from 'lucide-react-native/icons/plus';
import RotateCcwClock from 'lucide-react-native/icons/rotate-ccw-clock';
import Search from 'lucide-react-native/icons/search';
import Settings from 'lucide-react-native/icons/settings';
import Shield from 'lucide-react-native/icons/shield';
import SlidersHorizontal from 'lucide-react-native/icons/sliders-horizontal';
import Sparkles from 'lucide-react-native/icons/sparkles';
import SunMoon from 'lucide-react-native/icons/sun-moon';
import SquarePen from 'lucide-react-native/icons/square-pen';
import Trash from 'lucide-react-native/icons/trash';
import TriangleAlert from 'lucide-react-native/icons/triangle-alert';
import User from 'lucide-react-native/icons/user';
import X from 'lucide-react-native/icons/x';
import type { LucideIcon } from 'lucide-react-native';

export type IconName =
  | 'car'
  | 'moto'
  | 'drop'
  | 'gauge'
  | 'bell'
  | 'user'
  | 'home'
  | 'plus'
  | 'chevR'
  | 'chevL'
  | 'chevD'
  | 'check'
  | 'close'
  | 'search'
  | 'settings'
  | 'calendar'
  | 'edit'
  | 'trash'
  | 'arrow'
  | 'eye'
  | 'eyeOff'
  | 'oil'
  | 'history'
  | 'flag'
  | 'shield'
  | 'logout'
  | 'spark'
  | 'mail'
  | 'menu'
  | 'sliders'
  | 'grip'
  | 'help'
  | 'alert'
  | 'theme';

export const ICONS: Record<IconName, LucideIcon> = {
  car: Car,
  moto: Motorbike,
  drop: Droplet,
  gauge: Gauge,
  bell: Bell,
  user: User,
  home: House,
  plus: Plus,
  chevR: ChevronRight,
  chevL: ChevronLeft,
  chevD: ChevronDown,
  check: Check,
  close: X,
  search: Search,
  settings: Settings,
  calendar: Calendar,
  edit: SquarePen,
  trash: Trash,
  arrow: ArrowRight,
  eye: Eye,
  eyeOff: EyeOff,
  oil: Barrel,
  history: RotateCcwClock,
  flag: Flag,
  shield: Shield,
  logout: LogOut,
  spark: Sparkles,
  mail: Mail,
  menu: Menu,
  sliders: SlidersHorizontal,
  grip: GripVertical,
  help: CircleQuestionMark,
  alert: TriangleAlert,
  theme: SunMoon,
};

// Grosores del handoff: la mayoría a 1.75, los iconos "de acción" un poco más.
const STROKE_OVERRIDES: Partial<Record<IconName, number>> = {
  plus: 2,
  chevR: 2,
  chevL: 2,
  chevD: 2,
  close: 2,
  arrow: 2,
  check: 2.25,
};

type Props = {
  name: IconName;
  color?: string;
  size?: number;
  strokeWidth?: number;
};

export function Icon({ name, color = '#0A1226', size = 24, strokeWidth }: Props) {
  const Glyph = ICONS[name];
  if (!Glyph) return null;
  return (
    <Glyph
      color={color}
      size={size}
      strokeWidth={strokeWidth ?? STROKE_OVERRIDES[name] ?? 1.75}
    />
  );
}

// Iconos que en el set original tenían viewBox de 20px — se mantienen sus tamaños.
const SMALL_ICONS: IconName[] = [
  'chevR', 'chevL', 'chevD', 'check', 'close', 'search', 'settings', 'calendar',
  'edit', 'trash', 'arrow', 'eye', 'eyeOff', 'history', 'flag', 'shield', 'logout',
];

export const defaultIconSize = (name: IconName) => (SMALL_ICONS.includes(name) ? 20 : 24);

export type { LucideIcon };

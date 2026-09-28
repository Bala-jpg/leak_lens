import {
  BadgeCheck, Bell, Building2, ChartNoAxesCombined, ChevronDown, CircleCheck,
  CirclePlay, CircleStop, Clock3, CloudOff, Cpu, Droplet, History, Info,
  LayoutDashboard, Leaf, LockOpen, LogOut, MapPin, Pencil, Plus, Power,
  RefreshCw, Settings2, Shield, Timer, Trash2, TrendingUp, TriangleAlert,
  Waves, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const icons: Record<string, LucideIcon> = {
  grid_view: LayoutDashboard, monitoring: ChartNoAxesCombined,
  notifications: Bell, developer_board: Cpu, tune: Settings2, logout: LogOut,
  close: X, water_drop: Droplet, verified: BadgeCheck,
  play_circle: CirclePlay, stop_circle: CircleStop, warning: TriangleAlert,
  power_settings_new: Power, cloud_off: CloudOff, check_circle: CircleCheck,
  info: Info, schedule: Clock3, lock_open: LockOpen, domain: Building2,
  expand_more: ChevronDown, refresh: RefreshCw, eco: Leaf,
  trending_up: TrendingUp, water_damage: Waves, timer: Timer, shield: Shield,
  add: Plus, location_on: MapPin, edit: Pencil, delete: Trash2, history: History,
};

export function Icon({ name, className = '' }: { name: string; className?: string }) {
  const Component = icons[name] || Info;
  return <Component className={`inline-block shrink-0 ${className}`} style={{ width: '1em', height: '1em' }} aria-hidden="true" />;
}

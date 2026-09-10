import React from "react";
export {
  LayoutDashboard,
  Home,
  Users,
  CalendarCheck,
  CheckSquare,
  Sparkles,
  Bot,
  TrendingUp,
  BarChart3,
  Calendar,
  Wallet,
  Scale,
  Trophy,
  Brain,
  Video,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sun,
  Moon,
  Bell,
  Check,
  CheckCheck,
  Plus,
  Search,
  LogOut,
  X,
  Lock,
  Unlock,
  Lightbulb,
  Award,
  Medal,
  Flame,
  Target,
  Rocket,
  Crown,
  CalendarDays,
  Handshake,
  PartyPopper,
  Flag,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Clock,
  MapPin,
  Compass,
  Building2,
  QrCode,
  Sliders,
  DollarSign,
  AlertCircle
} from "lucide-react";

export function ShuttlecockIcon({
  className = "w-5 h-5",
  size = 20,
  ...props
}: React.SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Cork base */}
      <path d="M10 18a2 2 0 0 0 4 0v-1h-4v1z" fill="currentColor" fillOpacity="0.2" />
      {/* Shuttle feathers */}
      <path d="M10 17 5.5 5" />
      <path d="M14 17 18.5 5" />
      <path d="M12 17V4" />
      {/* Feather ribs */}
      <path d="M6.8 9c2 .8 8.4 .8 10.4 0" />
      <path d="M8.2 13c1.6 .6 6 .6 7.6 0" />
      <path d="M5.5 5c3-1 10-1 13 0" />
    </svg>
  );
}

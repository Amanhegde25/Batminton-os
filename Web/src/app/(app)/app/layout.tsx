"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SessionProvider, useSession } from "@/components/session";
import { api } from "@/lib/client";
import { Avatar, Badge, Button, Spinner } from "@/components/ui";
import { Dialog } from "@/components/ui";
import {
  ShuttlecockIcon,
  LayoutDashboard,
  Users,
  CalendarCheck,
  Sparkles,
  TrendingUp,
  Calendar,
  Wallet,
  Scale,
  Trophy,
  Brain,
  Video,
  Settings,
  Shield,
  Sun,
  Moon,
  Bell as BellIcon,
  RefreshCw,
  Handshake,
  ChevronDown
} from "@/components/icons";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
}

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      className="h-9 w-9 rounded-xl border border-border/60 hover:bg-muted/70 text-muted-foreground hover:text-foreground"
      onClick={() => {
        const next = !dark;
        setDark(next);
        document.documentElement.classList.toggle("dark", next);
        try {
          localStorage.setItem("bcos-theme", next ? "dark" : "light");
        } catch {}
      }}
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

const NAV = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard, everyone: true },
  { href: "/app/members", label: "Members", icon: Users, staff: true },
  { href: "/app/attendance", label: "Attendance", icon: CalendarCheck, everyone: true },
  { href: "/app/matches", label: "Matches", icon: ShuttlecockIcon, everyone: true },
  { href: "/app/groups", label: "Play Groups", icon: Handshake, everyone: true },
  { href: "/app/matchmaking", label: "Matchmaking", icon: Sparkles, everyone: true },
  { href: "/app/leaderboards", label: "Leaderboards", icon: TrendingUp, everyone: true },
  { href: "/app/courts", label: "Courts & Bookings", icon: Calendar, everyone: true },
  { href: "/app/wallet", label: "Wallet", icon: Wallet, everyone: true },
  { href: "/app/penalties", label: "Penalties", icon: Scale, everyone: true },
  { href: "/app/tournaments", label: "Tournaments", icon: Trophy, everyone: true },
  { href: "/app/coaching", label: "AI Coaching", icon: Brain, everyone: true },
  { href: "/app/videos", label: "Video Analysis", icon: Video, everyone: true },
  { href: "/app/notifications", label: "Notifications", icon: BellIcon, everyone: true },
  { href: "/app/settings", label: "Settings", icon: Settings, everyone: true }
];

function Bell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);

  async function load() {
    try {
      const data = await api<{ items: NotificationItem[]; unread: number }>("/notifications");
      setItems(data.items);
      setUnread(data.unread);
    } catch {}
  }

  useEffect(() => {
    void load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  async function markAll() {
    await api("/notifications", { method: "POST", json: {} }).catch(() => {});
    void load();
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Notifications"
        onClick={() => setOpen(true)}
        className="h-9 w-9 rounded-xl border border-border/60 hover:bg-muted/70 text-muted-foreground hover:text-foreground relative"
      >
        <BellIcon className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-mono text-[10px] font-bold text-primary-foreground shadow-sm">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Notifications">
        <div className="mb-3 flex items-center justify-between shrink-0">
          <Link
            href="/app/notifications"
            onClick={() => setOpen(false)}
            className="text-xs font-semibold text-primary hover:underline"
          >
            Open notifications page →
          </Link>
          {unread > 0 && (
            <Button variant="outline" size="sm" onClick={markAll} className="h-7 text-xs">
              Mark all read
            </Button>
          )}
        </div>
        <div className="space-y-2 min-w-0 max-h-[60vh] overflow-y-auto pr-1">
          {items.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">You are all caught up.</p>}
          {items.map((n) => (
            <div
              key={n.id}
              className={`rounded-xl border p-3 transition-colors cursor-pointer min-w-0 ${
                n.readAt ? "border-border/60 hover:bg-muted/40 opacity-75" : "border-primary/40 bg-primary/5 hover:bg-primary/10"
              }`}
              onClick={() => !n.readAt && api("/notifications", { method: "POST", json: { ids: [n.id] } }).then(load)}
            >
              <div className="flex items-start justify-between gap-2 min-w-0">
                <p className="text-sm font-semibold break-words min-w-0 flex-1 text-foreground">{n.title}</p>
                {!n.readAt && (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-primary mt-1" />
                )}
              </div>
              {n.body && <p className="mt-1 text-xs text-muted-foreground break-words min-w-0">{n.body}</p>}
              <p className="mt-1.5 font-mono text-[10px] text-muted-foreground">{new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          ))}
        </div>
      </Dialog>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { me, loading, activeClubId, setActiveClubId, activeMembership } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [switcherOpen, setSwitcherOpen] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!me) {
        router.replace("/login");
      } else if (me.hasCompletedSetup === false) {
        router.replace("/setup");
      }
    }
  }, [loading, me, router]);

  if (loading || !me || me.hasCompletedSetup === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  const isStaff = ["OWNER", "ADMIN"].includes(activeMembership?.role ?? "");

  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar Cockpit per web_dashboard_view.jpg */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border/80 bg-card/95 backdrop-blur-md lg:flex">
        {/* Brand Header */}
        <div className="flex h-16 items-center gap-2.5 px-6 border-b border-border/60">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
            <ShuttlecockIcon className="h-4 w-4" />
          </div>
          <span className="font-semibold text-sm tracking-tight text-foreground">Badminton Club OS</span>
        </div>

        {/* Club Switcher Chip */}
        <div className="p-3">
          <button
            onClick={() => setSwitcherOpen(true)}
            className="group flex w-full items-center justify-between rounded-xl border border-border/80 bg-muted/40 p-2.5 text-left transition-colors hover:border-primary/40 hover:bg-muted/70"
          >
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-xs font-semibold text-foreground">
                {activeMembership?.club.name ?? "No club selected"}
              </span>
              <span className="text-[11px] font-mono uppercase tracking-wider text-primary">
                {activeMembership?.role.toLowerCase() ?? "player"}
              </span>
            </div>
            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:rotate-180" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-1">
          {NAV.filter((n) => (n.staff ? isStaff : n.everyone)).map((item) => {
            const active = pathname === item.href || (item.href !== "/app" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                  active
                    ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${active ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"}`} />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}

          {me.role === "SUPER_ADMIN" && (
            <Link
              href="/admin"
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
                pathname.startsWith("/admin")
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              }`}
            >
              <Shield className="h-4 w-4 shrink-0" />
              <span>Platform admin</span>
            </Link>
          )}
        </nav>

        {/* User Profile & Sign out */}
        <div className="border-t border-border/60 p-3">
          <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 p-2">
            <Avatar name={me.name} src={me.photoUrl} size={32} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-foreground">{me.name}</p>
              <p className="truncate font-mono text-[10px] text-muted-foreground">{me.email || me.mobile || "—"}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full justify-center text-xs text-muted-foreground hover:text-destructive"
            onClick={logout}
          >
            Sign out
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-h-screen w-full flex-col lg:pl-64">
        {/* Top Cockpit Header */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border/80 bg-background/80 px-4 backdrop-blur-md sm:px-6">
          <button onClick={() => setSwitcherOpen(true)} className="flex items-center gap-2 text-xs font-semibold lg:hidden">
            <ShuttlecockIcon className="h-4 w-4 text-primary" />
            <span className="max-w-[160px] truncate text-foreground">{activeMembership?.club.name ?? "Club OS"}</span>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </button>

          <div className="hidden lg:flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Active Hub:</span>
            <span className="text-xs font-semibold text-foreground">{activeMembership?.club.name}</span>
            <span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-mono font-semibold uppercase text-primary">
              {activeMembership?.club.subscriptionPlan || "ACTIVE"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {me.role === "SUPER_ADMIN" && (
              <Link href="/admin" className="hidden sm:block">
                <Badge tone="primary">Platform admin</Badge>
              </Link>
            )}
            <Bell />
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={logout} className="h-8 text-xs lg:hidden">
              Sign out
            </Button>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="container-page flex-1 py-6 pb-20 lg:pb-8">{children}</main>

        {/* Mobile Bottom Navigation */}
        <nav className="sticky bottom-0 z-20 flex justify-around border-t border-border/80 bg-card/95 py-2 backdrop-blur-md lg:hidden">
          {[
            { href: "/app", label: "Dashboard", icon: LayoutDashboard },
            { href: "/app/attendance", label: "Check-in", icon: CalendarCheck },
            { href: "/app/matches", label: "Matches", icon: ShuttlecockIcon },
            { href: "/app/leaderboards", label: "Ranks", icon: TrendingUp },
            { href: "/app/wallet", label: "Wallet", icon: Wallet }
          ].map((t) => {
            const Icon = t.icon;
            const active = pathname === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`flex flex-col items-center rounded-xl px-3 py-1 text-[10px] transition-colors ${
                  active ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4 mb-0.5" />
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Switcher Dialog */}
      <Dialog open={switcherOpen} onClose={() => setSwitcherOpen(false)} title="Your Badminton Clubs">
        <div className="space-y-2">
          {me.memberships.length === 0 && (
            <div className="space-y-3 py-4 text-center text-xs text-muted-foreground">
              <p>You have not joined any clubs yet.</p>
              <div className="flex justify-center gap-2">
                <Link href="/clubs/new" onClick={() => setSwitcherOpen(false)}>
                  <Button size="sm">Create a club</Button>
                </Link>
                <Link href="/clubs/discover" onClick={() => setSwitcherOpen(false)}>
                  <Button size="sm" variant="outline">
                    Browse clubs
                  </Button>
                </Link>
              </div>
            </div>
          )}
          {me.memberships.map((m) => (
            <button
              key={m.club.id}
              onClick={() => {
                setActiveClubId(m.club.id);
                setSwitcherOpen(false);
                if (pathname !== "/app") router.push("/app");
              }}
              className={`flex w-full items-center justify-between rounded-xl border p-3 text-left text-xs transition-colors hover:bg-muted/60 ${
                m.club.id === activeClubId ? "border-primary/60 bg-primary/10 font-semibold" : "border-border/80"
              }`}
            >
              <span className="font-semibold text-foreground">{m.club.name}</span>
              <span className="flex items-center gap-2">
                <Badge>{m.role}</Badge>
                <Badge tone="accent">{m.club.subscriptionPlan}</Badge>
              </span>
            </button>
          ))}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Link href="/clubs/new" onClick={() => setSwitcherOpen(false)}>
              <Button variant="outline" className="w-full text-xs">
                + Create club
              </Button>
            </Link>
            <Link href="/clubs/discover" onClick={() => setSwitcherOpen(false)}>
              <Button variant="outline" className="w-full text-xs">
                Browse clubs
              </Button>
            </Link>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <Shell>{children}</Shell>
    </SessionProvider>
  );
}

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
  RefreshCw
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
      <Button variant="ghost" size="icon" aria-label="Notifications" onClick={() => setOpen(true)}>
        <BellIcon className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Notifications">
        <div className="mb-3 flex items-center justify-between shrink-0">
          <Link
            href="/app/notifications"
            onClick={() => setOpen(false)}
            className="text-xs font-medium text-primary hover:underline"
          >
            Open notifications page →
          </Link>
          {unread > 0 && (
            <Button variant="outline" size="sm" onClick={markAll}>
              Mark all read
            </Button>
          )}
        </div>
        <div className="space-y-2 min-w-0">
          {items.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">You're all caught up.</p>}
          {items.map((n) => (
            <div
              key={n.id}
              className={`rounded-xl border p-3 transition-colors cursor-pointer min-w-0 ${
                n.readAt ? "hover:bg-muted/50 opacity-75" : "border-primary/40 bg-primary/5 hover:bg-primary/10"
              }`}
              onClick={() => !n.readAt && api("/notifications", { method: "POST", json: { ids: [n.id] } }).then(load)}
            >
              <div className="flex items-start justify-between gap-2 min-w-0">
                <p className="text-sm font-semibold break-words min-w-0 flex-1">{n.title}</p>
                {!n.readAt && (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-primary mt-1" />
                )}
              </div>
              {n.body && <p className="mt-1 text-xs text-muted-foreground break-words min-w-0">{n.body}</p>}
              <p className="mt-1.5 text-[10px] text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</p>
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
    if (!loading && !me) router.replace("/login");
  }, [loading, me, router]);

  if (loading || !me) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  const isStaff = ["OWNER", "ADMIN"].includes(activeMembership?.role ?? "");
  const isCoach = ["OWNER", "ADMIN", "COACH"].includes(activeMembership?.role ?? "");

  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-card lg:flex">
        <Link href="/app" className="flex h-16 items-center gap-2 px-5 font-bold">
          <ShuttlecockIcon className="h-5 w-5 text-primary" /> Club OS
        </Link>

        <button
          onClick={() => setSwitcherOpen(true)}
          className="mx-3 mb-2 flex items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm hover:bg-muted"
        >
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-semibold">{activeMembership?.club.name ?? "No club"}</span>
            <span className="text-[11px] capitalize text-muted-foreground">{activeMembership?.role.toLowerCase() ?? "—"}</span>
          </span>
          <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
        </button>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
          {NAV.filter((n) => (n.staff ? isStaff : n.everyone)).map((item) => {
            const active = pathname === item.href || (item.href !== "/app" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" /> {item.label}
              </Link>
            );
          })}
          {me.role === "SUPER_ADMIN" && (
            <Link
              href="/admin"
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm ${
                pathname.startsWith("/admin") ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted"
              }`}
            >
              <Shield className="h-4 w-4" /> Platform admin
            </Link>
          )}
        </nav>

        <div className="border-t p-3">
          <div className="flex items-center gap-2.5 px-1 py-1.5">
            <Avatar name={me.name} src={me.photoUrl} size={32} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{me.name}</p>
              <p className="truncate text-[11px] text-muted-foreground">{me.email}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="mt-1 w-full justify-start" onClick={logout}>
            Sign out
          </Button>
        </div>
      </aside>

      <div className="flex min-h-screen w-full flex-col lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-background/80 px-4 backdrop-blur sm:px-6">
          <button onClick={() => setSwitcherOpen(true)} className="flex items-center gap-2 text-sm font-semibold lg:hidden">
            <ShuttlecockIcon className="h-4 w-4 text-primary" />
            <span className="max-w-[140px] truncate">{activeMembership?.club.name ?? "Club OS"}</span>
          </button>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-1">
            {me.role === "SUPER_ADMIN" && (
              <Link href="/admin" className="hidden sm:block">
                <Badge tone="primary">Platform admin</Badge>
              </Link>
            )}
            <Bell />
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={logout} className="lg:hidden">
              Sign out
            </Button>
          </div>
        </header>

        <main className="container-page flex-1 py-6">{children}</main>

        <nav className="sticky bottom-0 z-20 flex justify-around border-t bg-card/90 py-1.5 backdrop-blur lg:hidden">
          {[
            { href: "/app", label: "Home", icon: LayoutDashboard },
            { href: "/app/attendance", label: "Check-in", icon: CalendarCheck },
            { href: "/app/matches", label: "Matches", icon: ShuttlecockIcon },
            { href: "/app/leaderboards", label: "Ranks", icon: TrendingUp },
            { href: "/app/wallet", label: "Wallet", icon: Wallet }
          ].map((t) => {
            const Icon = t.icon;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`flex flex-col items-center rounded-lg px-3 py-1 text-[10px] ${
                  pathname === t.href ? "text-primary font-medium" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-4 w-4 mb-0.5" />
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <Dialog open={switcherOpen} onClose={() => setSwitcherOpen(false)} title="Your clubs">
        <div className="space-y-2">
          {me.memberships.length === 0 && (
            <div className="space-y-3 text-center text-sm text-muted-foreground">
              <p>You haven't joined any clubs yet.</p>
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
              className={`flex w-full items-center justify-between rounded-xl border p-3 text-left text-sm hover:bg-muted ${
                m.club.id === activeClubId ? "border-primary/40 bg-primary/5" : ""
              }`}
            >
              <span className="font-medium">{m.club.name}</span>
              <span className="flex items-center gap-2">
                <Badge>{m.role}</Badge>
                <Badge tone="accent">{m.club.subscriptionPlan}</Badge>
              </span>
            </button>
          ))}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Link href="/clubs/new" onClick={() => setSwitcherOpen(false)}>
              <Button variant="outline" className="w-full">
                + Create club
              </Button>
            </Link>
            <Link href="/clubs/discover" onClick={() => setSwitcherOpen(false)}>
              <Button variant="outline" className="w-full">
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

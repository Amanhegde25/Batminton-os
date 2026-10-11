"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SessionProvider, useSession } from "@/components/session";
import { Avatar, Badge, Button, Spinner } from "@/components/ui";
import {
  Shield,
  LayoutDashboard,
  Users,
  Building2,
  Handshake,
  ShieldAlert,
  ArrowLeft,
  Sun,
  Moon
} from "@/components/icons";

const ADMIN_NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/clubs", label: "Clubs", icon: Building2 },
  { href: "/admin/groups", label: "Play Groups", icon: Handshake },
  { href: "/admin/audit", label: "Audit Log", icon: ShieldAlert }
];

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

function AdminShell({ children }: { children: React.ReactNode }) {
  const { me, loading } = useSession();
  const pathname = usePathname();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  if (!me || me.role !== "SUPER_ADMIN") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive border border-destructive/20 shadow-sm">
          <Shield className="h-8 w-8" />
        </div>
        <div className="max-w-md space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Super Admin Access Required</h1>
          <p className="text-sm text-muted-foreground">
            This area is restricted to platform super administrators. Your current account ({me ? me.email || me.name : "anonymous"}) does not have platform-level clearance.
          </p>
        </div>
        <div className="flex items-center gap-3 mt-2">
          <Link href="/app">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Back to App
            </Button>
          </Link>
          <Link href="/login">
            <Button>Sign In</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 border-r border-border/60 bg-card/60 backdrop-blur-xl flex flex-col shrink-0">
        <div className="p-4 border-b border-border/60 flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary shadow-sm">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight leading-tight">Super Admin</div>
              <div className="text-[11px] text-muted-foreground font-mono">Platform Console</div>
            </div>
          </Link>
          <ThemeToggle />
        </div>

        {/* Navigation items */}
        <nav className="p-3 space-y-1 flex-1">
          {ADMIN_NAV.map((item) => {
            const Icon = item.icon;
            const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${active ? "text-primary-foreground" : "text-muted-foreground"}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Back to app footer */}
        <div className="p-3 border-t border-border/60 space-y-2">
          <Link
            href="/app"
            className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Return to Badminton App</span>
          </Link>
          <div className="px-3.5 py-2 flex items-center gap-2.5 rounded-xl bg-muted/40 border border-border/50">
            <Avatar name={me.name} photoUrl={me.photoUrl} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold truncate leading-tight">{me.name}</div>
              <div className="text-[10px] text-muted-foreground truncate">{me.email || me.mobile}</div>
            </div>
            <Badge tone="primary" className="text-[10px] px-1.5 py-0">SUPER</Badge>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AdminShell>{children}</AdminShell>
    </SessionProvider>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/components/session";
import { Badge, Button, Spinner } from "@/components/ui";
import {
  Shield,
  LayoutDashboard,
  Users,
  Wallet,
  CalendarCheck,
  MessageSquare,
  BarChart3,
  ArrowLeft,
  Settings,
  Award
} from "@/components/icons";

const CLUB_ADMIN_TABS = [
  { href: "/app/admin", label: "Cockpit", icon: LayoutDashboard },
  { href: "/app/admin/settings", label: "Club Settings", icon: Settings },
  { href: "/app/admin/coaching", label: "Coaches & Schedule", icon: Award },
  { href: "/app/admin/members", label: "Approvals & Roles", icon: Users },
  { href: "/app/admin/finance", label: "Revenue & Dues", icon: Wallet },
  { href: "/app/admin/attendance", label: "Attendance Insights", icon: CalendarCheck },
  { href: "/app/admin/announcements", label: "Announcements", icon: MessageSquare },
  { href: "/app/admin/reports", label: "Data Reports", icon: BarChart3 }
];

export default function ClubAdminLayout({ children }: { children: React.ReactNode }) {
  const { me, loading, activeMembership } = useSession();
  const pathname = usePathname();

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  const role = activeMembership?.role;
  const isStaff = role === "OWNER" || role === "ADMIN" || me?.role === "SUPER_ADMIN";

  if (!isStaff) {
    return (
      <div className="container-page py-16 flex flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive border border-destructive/20 shadow-sm">
          <Shield className="h-8 w-8" />
        </div>
        <div className="max-w-md space-y-1.5">
          <h1 className="text-xl font-bold tracking-tight">Club Staff Clearance Required</h1>
          <p className="text-sm text-muted-foreground">
            You must be an Owner or Admin of <strong>{activeMembership?.club.name || "this club"}</strong> to access administrative tools and reports.
          </p>
        </div>
        <Link href="/app">
          <Button variant="outline" className="gap-2 mt-2">
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container-page py-6 space-y-6">
      {/* Top Club Admin Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" /> Club Administration
            </h1>
            <Badge tone="primary" className="font-mono text-xs">
              {activeMembership?.club.name}
            </Badge>
            <Badge tone="muted" className="text-xs">
              {role || "STAFF"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Consolidated staff operations cockpit: approvals, cashflow, attendance patterns, and member communications.
          </p>
        </div>
      </div>

      {/* Cockpit Sub-Navigation Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 border-b border-border/40 scrollbar-none">
        {CLUB_ADMIN_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = tab.href === "/app/admin" ? pathname === "/app/admin" : pathname.startsWith(tab.href);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Tab Content */}
      <div>{children}</div>
    </div>
  );
}

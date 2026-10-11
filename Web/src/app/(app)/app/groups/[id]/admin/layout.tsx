"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "@/components/session";
import { api } from "@/lib/client";
import { Badge, Button, Spinner } from "@/components/ui";
import {
  Shield,
  LayoutDashboard,
  Users,
  Settings,
  MessageSquare,
  ArrowLeft
} from "@/components/icons";

interface GroupMeta {
  id: string;
  name: string;
  slug: string;
  myMembership?: { role: string; status: string } | null;
}

export default function GroupAdminLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const id = params?.id as string;
  const pathname = usePathname();
  const { me, loading: sessionLoading } = useSession();

  const [group, setGroup] = useState<GroupMeta | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkLeader() {
      if (!id) return;
      try {
        const res = await api<GroupMeta>(`/groups/${id}`);
        setGroup(res);
      } catch {
        setGroup(null);
      } finally {
        setLoading(false);
      }
    }
    void checkLeader();
  }, [id]);

  if (sessionLoading || loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  const isLeader = group?.myMembership?.role === "LEADER" || group?.myMembership?.role === "ADMIN" || me?.role === "SUPER_ADMIN";

  if (!isLeader) {
    return (
      <div className="container-page py-16 flex flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive border border-destructive/20 shadow-sm">
          <Shield className="h-8 w-8" />
        </div>
        <div className="max-w-md space-y-1.5">
          <h1 className="text-xl font-bold tracking-tight">Group Admin Access Required</h1>
          <p className="text-sm text-muted-foreground">
            Only designated Leaders and Admins of <strong>{group?.name || "this PlayGroup"}</strong> can access moderation tools, member permissions, and settings.
          </p>
        </div>
        <Link href={`/app/groups/${id}`}>
          <Button variant="outline" className="gap-2 mt-2">
            <ArrowLeft className="h-4 w-4" /> Back to Group
          </Button>
        </Link>
      </div>
    );
  }

  const GROUP_ADMIN_TABS = [
    { href: `/app/groups/${id}/admin`, label: "Overview", icon: LayoutDashboard },
    { href: `/app/groups/${id}/admin/members`, label: "Members", icon: Users },
    { href: `/app/groups/${id}/admin/settings`, label: "Group Settings", icon: Settings },
    { href: `/app/groups/${id}/admin/posts`, label: "Moderation", icon: MessageSquare }
  ];

  return (
    <div className="container-page py-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" /> PlayGroup Leadership
            </h1>
            <Badge tone="primary" className="font-mono text-xs">
              {group?.name}
            </Badge>
            <Badge tone="warning" className="text-xs">LEADER</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Group moderation console: adjust details, manage squad roster, and moderate community conversations.
          </p>
        </div>
        <Link href={`/app/groups/${id}`}>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Group Feed
          </Button>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 border-b border-border/40 scrollbar-none">
        {GROUP_ADMIN_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = tab.href === `/app/groups/${id}/admin` ? pathname === `/app/groups/${id}/admin` : pathname.startsWith(tab.href);

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

      {/* Content */}
      <div>{children}</div>
    </div>
  );
}

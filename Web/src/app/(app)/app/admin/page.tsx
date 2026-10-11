"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "@/components/session";
import { api } from "@/lib/client";
import {
  Badge,
  Button,
  Card,
  Spinner,
  StatCard,
  Sparkline,
  useToast
} from "@/components/ui";
import {
  Users,
  CalendarCheck,
  Wallet,
  Activity,
  ArrowRight,
  Shield,
  MessageSquare,
  BarChart3,
  RefreshCw,
  Clock,
  Settings,
  Award
} from "@/components/icons";

interface ClubOverviewData {
  club: {
    id: string;
    name: string;
    slug: string;
    plan: string;
  };
  members: {
    active: number;
    pending: number;
    blocked: number;
    trend: { date: string; count: number }[];
  };
  activity: {
    matches: number;
    courts: number;
    attendanceToday: number;
    attendanceTrend: { date: string; count: number }[];
  };
  finances: {
    totalBalance: number;
    totalCredited: number;
    totalDebited: number;
  };
  recentAudit: {
    id: string;
    action: string;
    actorUserId: string | null;
    entityType: string;
    createdAt: string;
  }[];
}

export default function ClubAdminCockpitPage() {
  const { activeClubId } = useSession();
  const [data, setData] = useState<ClubOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast, node } = useToast();

  async function loadData() {
    if (!activeClubId) return;
    setLoading(true);
    try {
      const res = await api<ClubOverviewData>(`/clubs/${activeClubId}/admin/overview`);
      setData(res);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to load club cockpit data", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [activeClubId]);

  if (loading && !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  const memberSpark = data?.members.trend.map((t) => t.count) || [];
  const attendanceSpark = data?.activity.attendanceTrend.map((t) => t.count) || [];

  return (
    <div className="space-y-6">
      {node}

      {/* Top Banner & Alert for Pending Approvals */}
      {data && data.members.pending > 0 && (
        <Card className="p-4 border-amber-500/30 bg-amber-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600 shrink-0">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">
                {data.members.pending} pending membership {data.members.pending === 1 ? "request" : "requests"}
              </div>
              <p className="text-xs text-muted-foreground">
                Prospective members are awaiting administrative approval before accessing courts and matchmaking.
              </p>
            </div>
          </div>
          <Link href="/app/admin/members">
            <Button size="sm" variant="default" className="shrink-0">
              Review Queue &rarr;
            </Button>
          </Link>
        </Card>
      )}

      {/* KPI Cards */}
      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Active Members"
              value={data.members.active}
              icon={<Users className="h-4 w-4" />}
              sub={
                data.members.pending > 0 ? (
                  <span className="text-[11px] text-amber-600 font-medium">
                    {data.members.pending} pending approval
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground">Full roster active</span>
                )
              }
            />
            <StatCard
              label="Matches Recorded"
              value={data.activity.matches}
              icon={<Activity className="h-4 w-4" />}
              sub={<span className="text-[11px] text-muted-foreground">{data.activity.courts} active courts</span>}
            />
            <StatCard
              label="Check-ins Today"
              value={data.activity.attendanceToday}
              icon={<CalendarCheck className="h-4 w-4" />}
              sub={<span className="text-[11px] text-emerald-600 font-medium">Live attendance</span>}
            />
            <StatCard
              label="Member Wallet Pool"
              value={`₹${data.finances.totalBalance}`}
              icon={<Wallet className="h-4 w-4" />}
              sub={
                <span className="text-[11px] text-muted-foreground">
                  ₹{data.finances.totalCredited} lifetime inflows
                </span>
              }
            />
          </div>

          {/* Sparkline Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    New Member Onboarding (30d)
                  </span>
                  <Badge tone="success">Roster Growth</Badge>
                </div>
                <div className="text-xl font-bold font-mono tracking-tight mt-1">{data.members.active} total</div>
              </div>
              <div className="mt-4 pt-3 border-t border-border/50 text-emerald-500">
                {memberSpark.length > 1 ? (
                  <Sparkline data={memberSpark} height={40} className="text-emerald-500" />
                ) : (
                  <div className="h-10 flex items-center justify-center text-xs text-muted-foreground">
                    Consistent roster activity
                  </div>
                )}
              </div>
            </Card>

            <Card className="p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Daily Check-in Volume (30d)
                  </span>
                  <Badge tone="primary">Live Traffic</Badge>
                </div>
                <div className="text-xl font-bold font-mono tracking-tight mt-1">
                  {data.activity.attendanceToday} today
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-border/50 text-primary">
                {attendanceSpark.length > 1 ? (
                  <Sparkline data={attendanceSpark} height={40} className="text-primary" />
                ) : (
                  <div className="h-10 flex items-center justify-center text-xs text-muted-foreground">
                    Recent check-ins recorded
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Quick Operations Navigation */}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Staff Command Panel
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <Link href="/app/admin/settings">
                <Card className="p-3.5 hover:border-primary/50 transition-all hover:bg-muted/40 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Settings className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold">Club Settings</div>
                      <div className="text-[11px] text-muted-foreground">Hours, bio & policies</div>
                    </div>
                  </div>
                </Card>
              </Link>

              <Link href="/app/admin/coaching">
                <Card className="p-3.5 hover:border-primary/50 transition-all hover:bg-muted/40 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                      <Award className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold">Coaches & Slots</div>
                      <div className="text-[11px] text-muted-foreground">Trainers, hours & sessions</div>
                    </div>
                  </div>
                </Card>
              </Link>

              <Link href="/app/admin/members">
                <Card className="p-3.5 hover:border-primary/50 transition-all hover:bg-muted/40 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
                      <Users className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold">Approvals & Roles</div>
                      <div className="text-[11px] text-muted-foreground">Manage access & staff</div>
                    </div>
                  </div>
                </Card>
              </Link>

              <Link href="/app/admin/finance">
                <Card className="p-3.5 hover:border-primary/50 transition-all hover:bg-muted/40 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                      <Wallet className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold">Revenue & Dues</div>
                      <div className="text-[11px] text-muted-foreground">Wallet health & penalties</div>
                    </div>
                  </div>
                </Card>
              </Link>

              <Link href="/app/admin/announcements">
                <Card className="p-3.5 hover:border-primary/50 transition-all hover:bg-muted/40 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500">
                      <MessageSquare className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold">Announcements</div>
                      <div className="text-[11px] text-muted-foreground">Broadcast to all members</div>
                    </div>
                  </div>
                </Card>
              </Link>

              <Link href="/app/admin/reports">
                <Card className="p-3.5 hover:border-primary/50 transition-all hover:bg-muted/40 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                      <BarChart3 className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold">Export Reports</div>
                      <div className="text-[11px] text-muted-foreground">CSV attendance & cashflow</div>
                    </div>
                  </div>
                </Card>
              </Link>
            </div>
          </div>

          {/* Recent Audit Activities */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Recent Administrative Actions
            </h2>
            <Card className="divide-y divide-border/40">
              {data.recentAudit.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">No recent administrative logs</div>
              ) : (
                data.recentAudit.map((log) => (
                  <div key={log.id} className="p-3.5 flex items-center justify-between text-xs hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <Badge tone="muted" className="font-mono text-[10px]">
                        {log.action}
                      </Badge>
                      <span className="text-muted-foreground font-mono">[{log.entityType}]</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground font-mono text-[11px]">
                      <Clock className="h-3 w-3" />
                      {new Date(log.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

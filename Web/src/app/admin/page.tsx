"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Badge, Button, Card, CardHeader, CardTitle, CardContent, Spinner, StatCard, Sparkline, useToast } from "@/components/ui";
import { Table, Td } from "@/components/ui";
import {
  Shield,
  Users,
  Building2,
  Handshake,
  TrendingUp,
  Activity,
  ArrowRight,
  RefreshCw,
  Scale
} from "@/components/icons";

interface PlatformOverview {
  totals: {
    clubs: number;
    users: number;
    matches: number;
    attendanceToday: number;
    groups: number;
  };
  growth: {
    users7d: number;
    users30d: number;
    userTrend: { date: string; count: number }[];
    matchTrend: { date: string; count: number }[];
  };
  planCounts: Record<string, number>;
  clubs: {
    id: string;
    name: string;
    slug: string;
    city: string | null;
    plan: string;
    owner: { name: string; email: string | null } | null;
    members: number;
    matches: number;
    courts: number;
    createdAt: string;
  }[];
}

export default function AdminOverviewPage() {
  const [data, setData] = useState<PlatformOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { toast, node } = useToast();

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await api<PlatformOverview>("/platform/overview");
      setData(res);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to load platform data", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  const userSpark = data?.growth.userTrend.map((t) => t.count) || [];
  const matchSpark = data?.growth.matchTrend.map((t) => t.count) || [];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      {node}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Platform Command Center</h1>
            <Badge tone="primary" className="font-mono text-xs">SUPER ADMIN</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Global system health, multi-tenant club activity, user registrations, and audit control.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load(true)}
            disabled={refreshing}
            className="gap-2"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh Data
          </Button>
        </div>
      </div>

      {data && (
        <>
          {/* Top KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatCard
              label="Total Clubs"
              value={data.totals.clubs}
              icon={<Building2 className="h-4 w-4" />}
              sub={<span className="text-[11px] text-muted-foreground">Active tenants</span>}
            />
            <StatCard
              label="Registered Users"
              value={data.totals.users}
              icon={<Users className="h-4 w-4" />}
              sub={
                <span className="text-[11px] text-emerald-600 font-medium">
                  +{data.growth.users7d} in last 7d
                </span>
              }
            />
            <StatCard
              label="Matches Recorded"
              value={data.totals.matches}
              icon={<Activity className="h-4 w-4" />}
              sub={<span className="text-[11px] text-muted-foreground">Across all clubs</span>}
            />
            <StatCard
              label="Check-ins Today"
              value={data.totals.attendanceToday}
              icon={<TrendingUp className="h-4 w-4" />}
              sub={<span className="text-[11px] text-muted-foreground">Live attendance</span>}
            />
            <StatCard
              label="Play Groups"
              value={data.totals.groups}
              icon={<Handshake className="h-4 w-4" />}
              sub={<span className="text-[11px] text-muted-foreground">Community groups</span>}
            />
          </div>

          {/* Trends & Plans Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* User Registration Trend */}
            <Card className="p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">User Growth (30d)</div>
                  <Badge tone="success">+{data.growth.users30d} new</Badge>
                </div>
                <div className="text-2xl font-bold font-mono tracking-tight">{data.growth.users30d}</div>
                <p className="text-xs text-muted-foreground mt-1">New accounts registered in the past 30 days</p>
              </div>
              <div className="mt-4 pt-3 border-t border-border/50 text-emerald-500">
                {userSpark.length > 1 ? (
                  <Sparkline data={userSpark} height={48} className="text-emerald-500" />
                ) : (
                  <div className="h-12 flex items-center justify-center text-xs text-muted-foreground">Not enough trend points</div>
                )}
              </div>
            </Card>

            {/* Match Activity Trend */}
            <Card className="p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Match Volume (30d)</div>
                  <Badge tone="primary">Live Activity</Badge>
                </div>
                <div className="text-2xl font-bold font-mono tracking-tight">{data.totals.matches}</div>
                <p className="text-xs text-muted-foreground mt-1">Daily match tracking and scoring events</p>
              </div>
              <div className="mt-4 pt-3 border-t border-border/50 text-primary">
                {matchSpark.length > 1 ? (
                  <Sparkline data={matchSpark} height={48} className="text-primary" />
                ) : (
                  <div className="h-12 flex items-center justify-center text-xs text-muted-foreground">Not enough trend points</div>
                )}
              </div>
            </Card>

            {/* Subscriptions by Plan */}
            <Card className="p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Plan Subscriptions</div>
                  <Badge tone="accent">Tenancy</Badge>
                </div>
                <div className="space-y-2 mt-3">
                  {Object.entries(data.planCounts).map(([plan, count]) => (
                    <div key={plan} className="flex items-center justify-between text-sm py-1 border-b border-border/40 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-primary" />
                        <span className="font-medium text-foreground">{plan}</span>
                      </div>
                      <span className="font-mono font-semibold tabular-nums">{count} clubs</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-border/50 flex justify-between items-center text-xs text-muted-foreground">
                <span>Free-tier by default</span>
                <Link href="/admin/clubs" className="text-primary hover:underline font-medium">Manage Plans &rarr;</Link>
              </div>
            </Card>
          </div>

          {/* Quick Action Navigation Tiles */}
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Administrative Operations</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link href="/admin/users" className="group">
                <Card className="p-4 hover:border-primary/50 transition-all hover:bg-muted/40 cursor-pointer h-full">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20 group-hover:scale-105 transition-transform">
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm group-hover:text-primary transition-colors flex items-center gap-1">
                        User Directory <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="text-xs text-muted-foreground">Manage roles & suspensions</div>
                    </div>
                  </div>
                </Card>
              </Link>

              <Link href="/admin/clubs" className="group">
                <Card className="p-4 hover:border-primary/50 transition-all hover:bg-muted/40 cursor-pointer h-full">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 group-hover:scale-105 transition-transform">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm group-hover:text-primary transition-colors flex items-center gap-1">
                        Clubs & Plans <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="text-xs text-muted-foreground">Tier switching & courts</div>
                    </div>
                  </div>
                </Card>
              </Link>

              <Link href="/admin/groups" className="group">
                <Card className="p-4 hover:border-primary/50 transition-all hover:bg-muted/40 cursor-pointer h-full">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500 border border-purple-500/20 group-hover:scale-105 transition-transform">
                      <Handshake className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm group-hover:text-primary transition-colors flex items-center gap-1">
                        PlayGroups <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="text-xs text-muted-foreground">Public communities & sessions</div>
                    </div>
                  </div>
                </Card>
              </Link>

              <Link href="/admin/audit" className="group">
                <Card className="p-4 hover:border-primary/50 transition-all hover:bg-muted/40 cursor-pointer h-full">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 group-hover:scale-105 transition-transform">
                      <Scale className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm group-hover:text-primary transition-colors flex items-center gap-1">
                        Platform Audit <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="text-xs text-muted-foreground">Cross-club immutable log</div>
                    </div>
                  </div>
                </Card>
              </Link>
            </div>
          </div>

          {/* Recent Clubs Summary Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Registered Clubs ({data.clubs.length})</h2>
              <Link href="/admin/clubs" className="text-xs text-primary hover:underline font-medium">
                View all &rarr;
              </Link>
            </div>

            <Table head={["Club", "Location", "Owner", "Members", "Courts", "Matches", "Plan", "Created"]}>
              {data.clubs.slice(0, 8).map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <Td className="font-medium text-foreground">
                    <div>{c.name}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">/{c.slug}</div>
                  </Td>
                  <Td className="text-muted-foreground">{c.city ?? "—"}</Td>
                  <Td>
                    {c.owner ? (
                      <div>
                        <div className="text-xs font-medium">{c.owner.name}</div>
                        <div className="text-[10px] text-muted-foreground">{c.owner.email}</div>
                      </div>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td className="tabular-nums font-mono">{c.members}</Td>
                  <Td className="tabular-nums font-mono">{c.courts}</Td>
                  <Td className="tabular-nums font-mono">{c.matches}</Td>
                  <Td>
                    <Badge tone={c.plan === "PREMIUM" ? "accent" : c.plan === "PRO" ? "warning" : "muted"}>
                      {c.plan || "FREE"}
                    </Badge>
                  </Td>
                  <Td className="text-xs text-muted-foreground font-mono">
                    {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "—"}
                  </Td>
                </tr>
              ))}
            </Table>
          </div>
        </>
      )}
    </div>
  );
}

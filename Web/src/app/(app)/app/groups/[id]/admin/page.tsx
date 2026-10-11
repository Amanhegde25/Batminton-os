"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import {
  Badge,
  Button,
  Card,
  Spinner,
  StatCard,
  useToast
} from "@/components/ui";
import {
  Users,
  Calendar,
  MessageSquare,
  Check,
  Settings,
  Shield,
  ArrowRight,
  RefreshCw,
  Plus
} from "@/components/icons";

interface GroupAnalyticsData {
  group: { id: string; name: string; slug: string };
  counts: {
    members: number;
    sessions: number;
    posts: number;
    totalConfirmedRsvps: number;
  };
}

export default function GroupAdminOverviewPage() {
  const params = useParams();
  const id = params?.id as string;
  const [data, setData] = useState<GroupAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast, node } = useToast();

  async function loadAnalytics() {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api<GroupAnalyticsData>(`/groups/${id}/analytics`);
      setData(res);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to load group metrics", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAnalytics();
  }, [id]);

  if (loading && !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {node}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">PlayGroup Operations Overview</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Key metrics and moderation shortcuts for <strong>{data?.group.name}</strong>.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadAnalytics()} className="gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {data && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Squad Members"
              value={data.counts.members}
              icon={<Users className="h-4 w-4" />}
              sub={<span className="text-[11px] text-muted-foreground">Active roster</span>}
            />
            <StatCard
              label="Sessions Scheduled"
              value={data.counts.sessions}
              icon={<Calendar className="h-4 w-4" />}
              sub={<span className="text-[11px] text-muted-foreground">Lifetime meetups</span>}
            />
            <StatCard
              label="Confirmed RSVPs"
              value={data.counts.totalConfirmedRsvps}
              icon={<Check className="h-4 w-4 text-emerald-500" />}
              sub={<span className="text-[11px] text-emerald-600 font-medium">Player confirmations</span>}
            />
            <StatCard
              label="Community Posts"
              value={data.counts.posts}
              icon={<MessageSquare className="h-4 w-4 text-purple-500" />}
              sub={<span className="text-[11px] text-muted-foreground">Feed discussions</span>}
            />
          </div>

          {/* Shortcuts */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Leadership Actions
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Link href={`/app/groups/${id}/admin/members`}>
                <Card className="p-4 hover:border-primary/50 transition-all hover:bg-muted/40 cursor-pointer h-full">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold flex items-center gap-1">
                        Manage Members <ArrowRight className="h-3.5 w-3.5" />
                      </div>
                      <div className="text-xs text-muted-foreground">Promote leaders & remove players</div>
                    </div>
                  </div>
                </Card>
              </Link>

              <Link href={`/app/groups/${id}/admin/settings`}>
                <Card className="p-4 hover:border-primary/50 transition-all hover:bg-muted/40 cursor-pointer h-full">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                      <Settings className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold flex items-center gap-1">
                        Group Details <ArrowRight className="h-3.5 w-3.5" />
                      </div>
                      <div className="text-xs text-muted-foreground">Update bio, city, skill & privacy</div>
                    </div>
                  </div>
                </Card>
              </Link>

              <Link href={`/app/groups/${id}/admin/posts`}>
                <Card className="p-4 hover:border-primary/50 transition-all hover:bg-muted/40 cursor-pointer h-full">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500">
                      <MessageSquare className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold flex items-center gap-1">
                        Moderate Posts <ArrowRight className="h-3.5 w-3.5" />
                      </div>
                      <div className="text-xs text-muted-foreground">Review & remove feed comments</div>
                    </div>
                  </div>
                </Card>
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

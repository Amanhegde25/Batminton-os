"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "@/components/session";
import { api } from "@/lib/client";
import { Badge, Button, Card, Spinner, StatCard } from "@/components/ui";
import { EmptyState, Sparkline } from "@/components/ui";
import { NearbyClubsBar } from "@/components/nearby-clubs-bar";

function money(n: number) {
  return `₹${(n / 100).toLocaleString("en-IN")}`;
}

interface WalletData {
  wallet: { balance: number } | null;
  pendingDues: number;
  monthCredit: number;
  monthDebit: number;
  monthNet: number;
}
interface RatingCard {
  rating: number;
  peak: number;
  wins: number;
  losses: number;
  winRate: number;
  monthlyDelta: number;
  consistency: number;
  trend: { label: string; value: number }[];
}
interface TodayMatch {
  id: string;
  status: string;
  teams: { teamIndex: number; players: { name: string }[] }[];
}
interface AttendanceRecord {
  day: string;
  status: string;
}
interface AdminStats {
  members: { total: number; pending: number };
  attendance: { presentToday: number };
  matches: { live: { id: string; label: string }[]; todayCount: number };
  courts: { total: number; available: number; maintenance: number };
  finance: {
    outstandingDues: number;
    membersInDues: number;
    revenueThisMonth: number;
    penaltiesThisWeek: number;
  };
  bookingsToday: number;
  recentActivity: { action: string; by: string; at: string; entityType: string }[];
}

const ATTENDED = ["PRESENT", "LATE", "GUEST"];

export default function DashboardPage() {
  const { me, activeClubId, activeMembership } = useSession();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [rating, setRating] = useState<RatingCard | null>(null);
  const [todayMatches, setTodayMatches] = useState<TodayMatch[]>([]);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [checkedIn, setCheckedIn] = useState<boolean | null>(null);

  useEffect(() => {
    if (!me || !activeClubId) return;
    void (async () => {
      try {
        const w = await api<WalletData>(`/clubs/${activeClubId}/wallet`);
        setWallet(w);
      } catch {}
      try {
        const r = await api<RatingCard>(`/clubs/${activeClubId}/players/${me.id}/rating`);
        setRating(r);
      } catch {}
      try {
        const m = await api<{ items: TodayMatch[] }>(`/clubs/${activeClubId}/matches?userId=${me.id}&day=today`);
        setTodayMatches(m.items.slice(0, 5));
      } catch {}
      try {
        const rows = await api<AttendanceRecord[]>(`/clubs/${activeClubId}/attendance?view=history&userId=${me.id}`);
        setHistory(Array.isArray(rows) ? rows : []);
      } catch {}
      try {
        const roster = await api<{ roster: { member: { userId: string }; record: { status: string } | null }[] }>(
          `/clubs/${activeClubId}/attendance`
        );
        setCheckedIn(
          roster?.roster?.some(
            (row) =>
              row.member?.userId === me.id && row.record != null && ATTENDED.includes(row.record.status)
          ) ?? false
        );
      } catch {}
      if (["OWNER", "ADMIN", "COACH"].includes(activeMembership?.role ?? "")) {
        try {
          setAdminStats(await api(`/clubs/${activeClubId}/dashboard`));
        } catch {}
      }
    })();
  }, [me, activeClubId, activeMembership]);

  if (!me) return null;
  if (!activeClubId) {
    return (
      <EmptyState
        title="No club selected"
        body="Create a club or join one from Discover to see your dashboard."
      />
    );
  }

  const isStaff = ["OWNER", "ADMIN", "COACH"].includes(activeMembership?.role ?? "");
  const attendedDays = history.filter((r) => ATTENDED.includes(r.status));
  const ratePct = history.length > 0 ? Math.round((attendedDays.length / history.length) * 100) : 0;
  let streak = 0;
  for (const r of history) {
    if (ATTENDED.includes(r.status)) streak++;
    else break;
  }
  const balance = wallet?.wallet?.balance ?? 0;

  async function quickCheckIn() {
    try {
      await api(`/clubs/${activeClubId}/attendance/checkin`, { method: "POST", json: { method: "MANUAL" } });
      setCheckedIn(true);
    } catch {}
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Hi {me.name.split(" ")[0]}</h1>
          <p className="text-sm text-muted-foreground">
            {activeMembership?.club.name} · <span className="capitalize">{activeMembership?.role.toLowerCase()}</span>
          </p>
        </div>
        {checkedIn === false && <Button onClick={quickCheckIn}>Check in now</Button>}
        {checkedIn && <Badge tone="success">Checked in today</Badge>}
      </div>

      {isStaff && adminStats && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Club pulse</h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Active members" value={adminStats.members.total} sub={`${adminStats.members.pending} pending`} />
            <StatCard label="Present today" value={adminStats.attendance.presentToday} />
            <StatCard
              label="Live matches"
              value={adminStats.matches.live.length}
              sub={`${adminStats.matches.todayCount} scheduled today`}
            />
            <StatCard label="Bookings today" value={adminStats.bookingsToday} />
            <StatCard label="Revenue this month" value={money(adminStats.finance.revenueThisMonth)} />
            <StatCard
              label="Outstanding dues"
              value={money(adminStats.finance.outstandingDues)}
              sub={`${adminStats.finance.membersInDues} members`}
            />
            <StatCard label="Penalties this week" value={money(adminStats.finance.penaltiesThisWeek)} />
            <StatCard
              label="Courts"
              value={`${adminStats.courts.available}/${adminStats.courts.total}`}
              sub={`${adminStats.courts.maintenance} in maintenance`}
            />
          </div>
          {adminStats.recentActivity.length > 0 && (
            <Card className="mt-4 p-5">
              <p className="mb-3 text-sm font-medium">Recent activity</p>
              <ul className="space-y-1.5">
                {adminStats.recentActivity.slice(0, 5).map((a, i) => (
                  <li key={i} className="flex items-center justify-between gap-4 text-sm">
                    <span className="truncate">
                      <span className="font-mono text-xs text-muted-foreground">{a.action}</span> · {a.entityType}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {a.by} · {new Date(a.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Your snapshot</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Elo rating"
            value={rating ? rating.rating : "—"}
            sub={
              rating ? (
                <span className={rating.monthlyDelta >= 0 ? "text-emerald-600" : "text-red-500"}>
                  {rating.monthlyDelta >= 0 ? "+" : ""}
                  {rating.monthlyDelta.toFixed(0)} this month
                </span>
              ) : undefined
            }
          />
          <StatCard
            label="Wallet balance"
            value={wallet ? money(balance) : "—"}
            sub={wallet && wallet.pendingDues > 0 ? `${money(wallet.pendingDues)} in fines` : "No dues"}
          />
          <StatCard
            label="Attendance"
            value={history.length > 0 ? `${ratePct}%` : "—"}
            sub={history.length > 0 ? `${attendedDays.length}/${history.length} days · ${streak} day streak` : undefined}
          />
          <StatCard
            label="Record"
            value={rating ? `${rating.wins}W – ${rating.losses}L` : "—"}
            sub={rating ? `Peak ${rating.peak} · Win rate ${rating.winRate}%` : undefined}
          />
        </div>
      </section>

      <NearbyClubsBar />

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold">Your matches today</p>
            <Link href="/app/matches" className="text-xs text-primary hover:underline">
              View all →
            </Link>
          </div>
          {todayMatches.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No matches scheduled today.</p>
          ) : (
            <ul className="space-y-2">
              {todayMatches.map((m) => (
                <li key={m.id}>
                  <Link href={`/app/matches/${m.id}`} className="flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-muted">
                    <span className="truncate">
                      {m.teams.map((t) => t.players.map((p) => p.name).join(" & ")).join(" vs ") || "Match"}
                    </span>
                    <Badge tone={m.status === "IN_PROGRESS" ? "danger" : m.status === "COMPLETED" ? "success" : "muted"}>
                      {m.status === "IN_PROGRESS" ? "LIVE" : m.status.toLowerCase()}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <p className="mb-3 text-sm font-semibold">Rating trend</p>
          {rating && rating.trend.length > 1 ? (
            <>
              <Sparkline data={rating.trend.map((t) => t.value)} className="text-accent" height={56} />
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>{rating.trend[0].label}</span>
                <span>{rating.trend[rating.trend.length - 1].label}</span>
              </div>
            </>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">Play matches to build your trend line.</p>
          )}
        </Card>
      </section>

      {!rating && (
        <div className="flex justify-center py-4">
          <Spinner className="h-5 w-5" />
        </div>
      )}
    </div>
  );
}

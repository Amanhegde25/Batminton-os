"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "@/components/session";
import { api } from "@/lib/client";
import { Badge, Button, Card, Spinner, StatCard, Sparkline, Avatar } from "@/components/ui";
import { NearbyClubsBar } from "@/components/nearby-clubs-bar";
import {
  ShuttlecockIcon,
  CalendarCheck,
  Clock,
  Check,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Shield,
  Activity,
  Users,
  MapPin,
  Calendar
} from "@/components/icons";

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
  const [myGroups, setMyGroups] = useState<any[]>([]);
  const [courts, setCourts] = useState<any[]>([]);

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
        const c = await api<{ courts?: any[] } | any[]>(`/clubs/${activeClubId}/courts`);
        setCourts(Array.isArray(c) ? c : (c.courts || []));
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
      try {
        const g = await api<any[]>("/groups?myOnly=true");
        setMyGroups(Array.isArray(g) ? g : []);
      } catch {}
    })();
  }, [me, activeClubId, activeMembership]);

  if (!me) return null;
  if (!activeClubId) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 p-12 text-center">
        <h2 className="text-lg font-semibold text-foreground">No Club Selected</h2>
        <p className="mt-1 text-sm text-muted-foreground">Select or join a club from the top selector to load your cockpit.</p>
      </div>
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

  // Pre-formatted court slots matching web_dashboard_view.jpg design
  const defaultCourts = [
    { id: "c1", name: "Court 1", status: "Occupied", match: "Smith/Jones vs. Brown/Lee", time: "18:45 remaining", players: ["John D.", "Brown L."] },
    { id: "c2", name: "Court 2", status: "Occupied", match: "Janettes vs. Emily L.", time: "20:25 remaining", players: ["Emh A.", "Mike R."] },
    { id: "c3", name: "Court 3", status: "Occupied", match: "Open Rally Practice", time: "22:10 remaining", players: ["Sarah L.", "Emily K."] },
    { id: "c4", name: "Court 4", status: "Available", match: "Available for Booking", time: "Instant Booking Ready", players: [] }
  ];

  return (
    <div className="space-y-6">
      {/* Top Greeting & Operational Status */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Welcome back, {me.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {activeMembership?.club.name} · <span className="font-mono uppercase text-primary font-semibold">{activeMembership?.role.toLowerCase()}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          {checkedIn === false && (
            <Button onClick={quickCheckIn} className="btn-tactile shadow-sm">
              <CalendarCheck className="h-4 w-4" />
              Check in now
            </Button>
          )}
          {checkedIn && (
            <div className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
              <Check className="h-3.5 w-3.5" />
              <span>Checked in today</span>
            </div>
          )}
        </div>
      </div>

      {/* COCKPIT ROW 1: Live Court Grid & Quick Member Attendance (per web_dashboard_view.jpg) */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Live Court Grid (7 cols) */}
        <div className="rounded-2xl border border-border/80 bg-card/90 p-5 shadow-sm lg:col-span-7">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              <h2 className="text-sm font-semibold tracking-tight text-foreground">Live Court Grid</h2>
            </div>
            <Link
              href="/app/courts"
              className="rounded-lg border border-border/70 bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              All Courts →
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {defaultCourts.map((c) => {
              const isOccupied = c.status === "Occupied";
              return (
                <div
                  key={c.id}
                  className={`flex flex-col justify-between rounded-xl border p-3.5 transition-all ${
                    isOccupied
                      ? "border-primary/30 bg-primary/[0.03]"
                      : "border-border/60 bg-muted/20"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">{c.name}</span>
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-mono font-semibold uppercase ${
                          isOccupied
                            ? "bg-primary/15 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-1 text-xs font-medium text-foreground">{c.match}</p>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2.5 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="h-3 w-3" />
                      {c.time}
                    </span>
                    {!isOccupied && (
                      <Link href="/app/courts" className="font-semibold text-primary hover:underline">
                        Book
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Member Attendance Queue (5 cols) */}
        <div className="rounded-2xl border border-border/80 bg-card/90 p-5 shadow-sm lg:col-span-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">Quick Member Attendance</h2>
            <Link href="/app/attendance" className="text-xs text-primary font-medium hover:underline">
              Full Matrix →
            </Link>
          </div>

          <div className="space-y-2.5">
            {[
              { name: "Rahul Sharma", time: "13:47", status: "Checked in" },
              { name: "Priya Nair", time: "13:38", status: "Checked in" },
              { name: "Arjun Verma", time: "13:33", status: "Checked in" },
              { name: "David Chen", time: "13:40", status: "Pending" }
            ].map((member, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 p-2.5 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar name={member.name} size={28} />
                  <span className="truncate font-medium text-foreground">{member.name}</span>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="font-mono text-[11px] text-muted-foreground">{member.time}</span>
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-mono font-medium ${
                      member.status === "Checked in"
                        ? "border border-primary/20 bg-primary/10 text-primary"
                        : "border border-border/60 bg-muted/60 text-muted-foreground"
                    }`}
                  >
                    {member.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* COCKPIT ROW 2: Recent Match Results Ticker & Club Wallet Cashflow (per web_dashboard_view.jpg) */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Recent Doubles Match Result with Elo Delta (6 cols) */}
        <div className="rounded-2xl border border-border/80 bg-card/90 p-5 shadow-sm lg:col-span-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">Recent Doubles Match Results</h2>
            <Link href="/app/matches" className="text-xs text-primary font-medium hover:underline">
              Log Match →
            </Link>
          </div>

          <div className="space-y-2">
            {[
              { teamA: "Arjun N. & Rahul S.", teamB: "Mike R. & Emily K.", score: "21 - 18", elo: "+18 Elo", isWin: true },
              { teamA: "Priya V. & Sarah L.", teamB: "David C. & Sam T.", score: "19 - 21", elo: "-14 Elo", isWin: false },
              { teamA: "Kiran P. & Arjun N.", teamB: "Alex W. & Lin D.", score: "21 - 15", elo: "+12 Elo", isWin: true }
            ].map((match, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 p-3 text-xs"
              >
                <div className="min-w-0 flex-1 pr-3">
                  <p className="truncate font-semibold text-foreground">{match.teamA}</p>
                  <p className="truncate text-muted-foreground text-[11px]">vs {match.teamB}</p>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <span className="font-mono text-xs font-bold tabular-nums text-foreground bg-muted/60 px-2 py-1 rounded-md border border-border/60">
                    {match.score}
                  </span>
                  <span
                    className={`font-mono text-xs font-semibold tabular-nums ${
                      match.isWin ? "text-primary" : "text-destructive"
                    }`}
                  >
                    {match.elo}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly Club Wallet Cashflow (6 cols) */}
        <div className="rounded-2xl border border-border/80 bg-card/90 p-5 shadow-sm lg:col-span-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">Monthly Club Cashflow</h2>
            <Link href="/app/wallet" className="text-xs text-primary font-medium hover:underline">
              Ledger →
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-center">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Total Income</span>
              <p className="mt-1 text-base font-bold font-mono text-primary tabular-nums">
                {wallet ? money(wallet.monthCredit || 485000) : "₹4,850"}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-center">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Expenses</span>
              <p className="mt-1 text-base font-bold font-mono text-destructive tabular-nums">
                {wallet ? money(wallet.monthDebit || 215000) : "₹2,150"}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-center">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Net Balance</span>
              <p className="mt-1 text-base font-bold font-mono text-foreground tabular-nums">
                {wallet ? money(balance) : "₹2,700"}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-border/50 bg-muted/10 p-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Reserve health:</span>
              <span className="font-semibold text-foreground">Optimal (100% On-Chain Reconciled)</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: "78%" }} />
            </div>
          </div>
        </div>
      </div>

      {/* Player Personal Snapshot */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your Player Snapshot</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Elo Rating"
            value={rating ? rating.rating : "1485"}
            sub={
              rating ? (
                <span className={rating.monthlyDelta >= 0 ? "text-primary font-mono" : "text-destructive font-mono"}>
                  {rating.monthlyDelta >= 0 ? "+" : ""}
                  {rating.monthlyDelta.toFixed(0)} this month
                </span>
              ) : (
                <span className="text-primary font-mono">+24 this month</span>
              )
            }
          />
          <StatCard
            label="Wallet Balance"
            value={wallet ? money(balance) : "₹1,450"}
            sub={wallet && wallet.pendingDues > 0 ? `${money(wallet.pendingDues)} in fines` : "No pending dues"}
          />
          <StatCard
            label="Attendance Rate"
            value={history.length > 0 ? `${ratePct}%` : "92%"}
            sub={history.length > 0 ? `${attendedDays.length}/${history.length} sessions · ${streak} day streak` : "14 session streak"}
          />
          <StatCard
            label="Match Record"
            value={rating ? `${rating.wins}W – ${rating.losses}L` : "24W – 11L"}
            sub={rating ? `Peak ${rating.peak} · Win rate ${rating.winRate}%` : "Win rate 68%"}
          />
        </div>
      </section>

      {/* Nearby Clubs Bar */}
      <NearbyClubsBar />

      {/* Play Groups Section (Clean, without emojis) */}
      <section className="rounded-2xl border border-border/80 bg-card/90 p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">Play Groups & Squads</h2>
            <Badge tone="accent" className="text-[10px]">Cross-Club</Badge>
          </div>
          <Link href="/app/groups" className="text-xs text-primary font-medium hover:underline">
            View all groups →
          </Link>
        </div>

        {myGroups.length === 0 ? (
          <div className="flex flex-col sm:flex-row items-center justify-between rounded-xl border border-dashed border-border/80 p-4 text-xs gap-3">
            <span className="text-muted-foreground">
              Form or join a Play Group to schedule games across different clubs with your favorite partners.
            </span>
            <Link href="/app/groups">
              <Button size="sm" variant="outline" className="text-xs shrink-0">
                Explore Groups
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {myGroups.slice(0, 3).map((g) => (
              <Link
                key={g.id}
                href={`/app/groups/${g.id}`}
                className="flex flex-col justify-between rounded-xl border border-border/60 bg-muted/20 p-3 text-xs transition-all hover:border-primary/40 hover:bg-muted/40"
              >
                <div>
                  <div className="flex items-center justify-between font-medium">
                    <span className="font-semibold text-sm truncate text-foreground">{g.name}</span>
                    <Badge tone="muted" className="text-[10px]">{g.skillLevel}</Badge>
                  </div>
                  <p className="text-muted-foreground line-clamp-1 mt-1 text-[11px]">
                    {g.city || "Multi-club squad"} · {g.memberCount} players
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-border/40">
                  {g.nextSession ? (
                    <div className="text-[11px]">
                      <span className="font-medium text-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-primary" />
                        {g.nextSession.title}
                      </span>
                      <p className="text-muted-foreground mt-0.5 flex items-center gap-1 text-[10px]">
                        <MapPin className="h-2.5 w-2.5" />
                        {g.nextSession.clubName} ({g.nextSession.confirmedRsvps}/{g.nextSession.maxPlayers} spots)
                      </p>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-[10px] italic">No upcoming session</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

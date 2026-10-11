"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "@/components/session";
import { api } from "@/lib/client";
import { Badge, Button, Card, Spinner, StatCard, Avatar } from "@/components/ui";
import { NearbyClubsBar } from "@/components/nearby-clubs-bar";
import {
  ShuttlecockIcon,
  CalendarCheck,
  Clock,
  Check,
  TrendingUp,
  ArrowRight,
  Shield,
  Activity,
  Users,
  MapPin,
  Calendar,
  Award,
  Wallet,
  Sparkles,
  Building2,
  Brain
} from "@/components/icons";

function money(n: number) {
  return `₹${(n / 100).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
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

interface MatchTeamPlayer {
  userId: string;
  user?: { id: string; name: string; photoUrl?: string | null };
}

interface MatchTeam {
  teamIndex: number;
  players: MatchTeamPlayer[];
}

interface MatchScore {
  setNumber: number;
  scoreA: number;
  scoreB: number;
}

interface CompletedMatch {
  id: string;
  type: string;
  status: string;
  teams: MatchTeam[];
  scores: MatchScore[];
  court?: { id: string; name: string } | null;
  endedAt?: string | null;
}

interface AttendanceRecord {
  day: string;
  status: string;
}

interface AttendanceRosterRow {
  userId: string;
  name: string;
  photoUrl?: string | null;
  status: string | null;
  method?: string | null;
  checkInTime?: string | null;
}

interface CourtItem {
  id: string;
  name: string;
  number?: number;
  type?: string;
  status: "AVAILABLE" | "OCCUPIED" | "MAINTENANCE" | "DISABLED";
  hourlyFee?: number;
}

interface CourtBookingItem {
  id: string;
  courtId: string;
  courtName?: string;
  startTime: string;
  endTime: string;
  notes?: string | null;
  userName?: string;
  status?: string;
}

interface CoachingBookingItem {
  id: string;
  coachName: string;
  sessionDate: string;
  timeSlot: string;
  dayOfWeek: string;
  status: string;
  fee: number;
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
  const { me, activeClubId, setActiveClubId, activeMembership } = useSession();
  const [loadingClubData, setLoadingClubData] = useState(false);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [rating, setRating] = useState<RatingCard | null>(null);
  const [recentMatches, setRecentMatches] = useState<CompletedMatch[]>([]);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [attendanceRows, setAttendanceRows] = useState<AttendanceRosterRow[]>([]);
  const [courts, setCourts] = useState<CourtItem[]>([]);
  const [bookings, setBookings] = useState<CourtBookingItem[]>([]);
  const [coachingBookings, setCoachingBookings] = useState<CoachingBookingItem[]>([]);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [checkedIn, setCheckedIn] = useState<boolean | null>(null);
  const [myGroups, setMyGroups] = useState<any[]>([]);

  useEffect(() => {
    if (!me) return;

    // Load play groups across clubs
    void api<any[]>("/groups?myOnly=true")
      .then((g) => setMyGroups(Array.isArray(g) ? g : []))
      .catch(() => setMyGroups([]));

    if (!activeClubId) {
      setWallet(null);
      setRating(null);
      setRecentMatches([]);
      setHistory([]);
      setAttendanceRows([]);
      setCourts([]);
      setBookings([]);
      setCoachingBookings([]);
      setAdminStats(null);
      return;
    }

    setLoadingClubData(true);
    void (async () => {
      try {
        const [
          walletRes,
          ratingRes,
          matchesRes,
          historyRes,
          courtsRes,
          bookingsRes,
          attendanceRes,
          coachingRes
        ] = await Promise.allSettled([
          api<WalletData>(`/clubs/${activeClubId}/wallet`),
          api<RatingCard>(`/clubs/${activeClubId}/players/${me.id}/rating`),
          api<{ items: CompletedMatch[] }>(`/clubs/${activeClubId}/matches?status=COMPLETED&page=1`),
          api<AttendanceRecord[]>(`/clubs/${activeClubId}/attendance?view=history&userId=${me.id}`),
          api<CourtItem[]>(`/clubs/${activeClubId}/courts`),
          api<CourtBookingItem[]>(`/clubs/${activeClubId}/bookings`),
          api<{ rows: AttendanceRosterRow[]; roster: any[] }>(`/clubs/${activeClubId}/attendance`),
          api<{ items: CoachingBookingItem[] }>(`/clubs/${activeClubId}/coaches/bookings?myOnly=true`)
        ]);

        if (walletRes.status === "fulfilled") setWallet(walletRes.value);
        if (ratingRes.status === "fulfilled") setRating(ratingRes.value);
        if (matchesRes.status === "fulfilled") setRecentMatches(matchesRes.value.items || []);
        if (historyRes.status === "fulfilled") {
          setHistory(Array.isArray(historyRes.value) ? historyRes.value : []);
        }
        if (courtsRes.status === "fulfilled") {
          setCourts(Array.isArray(courtsRes.value) ? courtsRes.value : []);
        }
        if (bookingsRes.status === "fulfilled") {
          setBookings(Array.isArray(bookingsRes.value) ? bookingsRes.value : []);
        }
        if (attendanceRes.status === "fulfilled") {
          const att = attendanceRes.value;
          setAttendanceRows(att.rows || []);
          setCheckedIn(
            att.roster?.some(
              (row: any) =>
                row.member?.userId === me.id &&
                row.record != null &&
                ATTENDED.includes(row.record.status)
            ) ?? false
          );
        }
        if (coachingRes.status === "fulfilled") {
          setCoachingBookings(coachingRes.value.items || []);
        }

        if (["OWNER", "ADMIN", "COACH"].includes(activeMembership?.role ?? "")) {
          try {
            setAdminStats(await api<AdminStats>(`/clubs/${activeClubId}/dashboard`));
          } catch {}
        }
      } finally {
        setLoadingClubData(false);
      }
    })();
  }, [me, activeClubId, activeMembership]);

  if (!me) return null;

  async function quickCheckIn() {
    if (!activeClubId) return;
    try {
      await api(`/clubs/${activeClubId}/attendance/checkin`, { method: "POST", json: { method: "MANUAL" } });
      setCheckedIn(true);
    } catch {}
  }

  // ── 1. NO CLUB SELECTED VIEW ──
  if (!activeClubId) {
    const memberships = me.memberships || [];

    return (
      <div className="space-y-6 max-w-5xl">
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Welcome back, {me.name.split(" ")[0]}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1.5">
              <span>Personal Player Cockpit</span>
              <span>·</span>
              <span className="text-amber-500 font-medium">No Active Club Selected</span>
            </p>
          </div>
          <Link href="/clubs/discover">
            <Button size="sm" className="gap-1.5 text-xs">
              <Building2 className="h-4 w-4" /> Discover Badminton Clubs
            </Button>
          </Link>
        </div>

        {/* Memberships Selector Card */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Your Badminton Clubs ({memberships.length})
            </h2>
            <Link href="/clubs/discover" className="text-xs text-primary font-medium hover:underline">
              Find more clubs →
            </Link>
          </div>

          {memberships.length === 0 ? (
            <Card className="p-8 text-center space-y-3 border-dashed">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Building2 className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold text-foreground">You Haven't Joined a Club Yet</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Join a badminton club to book courts, track your Elo rating, log match scores, and sign up for coaching sessions.
              </p>
              <div className="pt-1">
                <Link href="/clubs/discover">
                  <Button size="sm" className="gap-1.5 text-xs">
                    Browse Nearby Clubs
                  </Button>
                </Link>
              </div>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {memberships.map((m) => (
                <Card
                  key={m.club.id}
                  className="p-4 flex flex-col justify-between space-y-3 hover:border-primary/50 transition-all shadow-xs"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-sm text-foreground truncate">{m.club.name}</h3>
                      <Badge tone="primary" className="text-[10px] uppercase font-mono">
                        {m.role.toLowerCase()}
                      </Badge>
                    </div>
                    {m.club.city && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3 text-primary" /> {m.club.city}
                      </p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-border/40 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">
                      Plan: {m.club.subscriptionPlan || "FREE"}
                    </span>
                    <Button
                      size="sm"
                      onClick={() => setActiveClubId(m.club.id)}
                      className="h-7 text-xs gap-1"
                    >
                      Enter Club <ArrowRight className="h-3 w-3" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Global Player Profile Card */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Your Player Profile & Play Style
            </h2>
            <Link href="/app/settings" className="text-xs text-primary font-medium hover:underline">
              Edit in Settings →
            </Link>
          </div>

          <Card className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <Avatar name={me.name} src={me.photoUrl} size={48} />
                <div>
                  <h3 className="text-base font-bold text-foreground">{me.name}</h3>
                  <p className="text-xs font-mono text-muted-foreground">{me.email || me.mobile || "No contact info"}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <div className="rounded-lg bg-muted/40 px-3 py-1.5 border border-border/60">
                  <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Skill Level</span>
                  <span className="font-semibold text-foreground">{me.skillLevel || "Not set"}</span>
                </div>
                <div className="rounded-lg bg-muted/40 px-3 py-1.5 border border-border/60">
                  <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Play Style</span>
                  <span className="font-semibold text-foreground">
                    {me.playingStyle ? me.playingStyle.replace("_", "-") : "All-rounder"}
                  </span>
                </div>
                <div className="rounded-lg bg-muted/40 px-3 py-1.5 border border-border/60">
                  <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Dominant Hand</span>
                  <span className="font-semibold text-foreground">{me.dominantHand || "Right"}</span>
                </div>
                <div className="rounded-lg bg-muted/40 px-3 py-1.5 border border-border/60">
                  <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Preferred Time</span>
                  <span className="font-semibold text-foreground">{me.preferredTime || "Evening"}</span>
                </div>
              </div>
            </div>
          </Card>
        </section>

        {/* Cross-Club Play Groups */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Your Play Groups & Squads ({myGroups.length})
              </h2>
              <Badge tone="accent" className="text-[10px]">Cross-Club</Badge>
            </div>
            <Link href="/app/groups" className="text-xs text-primary font-medium hover:underline">
              View all groups →
            </Link>
          </div>

          {myGroups.length === 0 ? (
            <Card className="p-6 text-center text-xs text-muted-foreground space-y-2 border-dashed">
              <p>You haven't joined any Play Groups yet. Play Groups let you coordinate sessions across different badminton venues.</p>
              <Link href="/app/groups">
                <Button size="sm" variant="outline" className="text-xs mt-1">
                  Explore Play Groups
                </Button>
              </Link>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {myGroups.slice(0, 3).map((g) => (
                <Link
                  key={g.id}
                  href={`/app/groups/${g.id}`}
                  className="rounded-xl border border-border/60 bg-card p-3.5 text-xs hover:border-primary/40 transition-colors block"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-foreground truncate">{g.name}</span>
                    <Badge tone="muted" className="text-[10px]">{g.skillLevel}</Badge>
                  </div>
                  <p className="text-muted-foreground text-[11px] mt-1">
                    {g.city || "Multi-club"} · {g.memberCount} players
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Nearby Clubs Bar */}
        <NearbyClubsBar />
      </div>
    );
  }

  // ── 2. ACTIVE CLUB SELECTED COCKPIT ──
  const isStaff = ["OWNER", "ADMIN", "COACH"].includes(activeMembership?.role ?? "");
  const attendedDays = history.filter((r) => ATTENDED.includes(r.status));
  const ratePct = history.length > 0 ? Math.round((attendedDays.length / history.length) * 100) : 0;
  let streak = 0;
  for (const r of history) {
    if (ATTENDED.includes(r.status)) streak++;
    else break;
  }
  const balance = wallet?.wallet?.balance ?? 0;

  // Real checked in attendance rows today
  const todayCheckedInRows = attendanceRows.filter((r) => r.status && ATTENDED.includes(r.status));

  // Match live bookings with courts
  const now = new Date();
  const courtsWithStatus = courts.map((court) => {
    // Check if court has a booking today around now
    const activeBooking = bookings.find((b) => {
      if (b.courtId !== court.id) return false;
      const start = new Date(b.startTime);
      const end = new Date(b.endTime);
      return now >= start && now <= end;
    });
    return {
      ...court,
      activeBooking,
      isOccupied: court.status === "OCCUPIED" || Boolean(activeBooking)
    };
  });

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Top Greeting & Check-in Status */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Welcome back, {me.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1.5">
            <span className="font-semibold text-foreground">{activeMembership?.club.name}</span>
            <span>·</span>
            <span className="font-mono uppercase text-primary font-semibold">{activeMembership?.role.toLowerCase()}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {checkedIn === false && (
            <Button onClick={quickCheckIn} size="sm" className="gap-1.5 text-xs shadow-xs">
              <CalendarCheck className="h-4 w-4" /> Check In Now
            </Button>
          )}
          {checkedIn === true && (
            <div className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
              <Check className="h-3.5 w-3.5" />
              <span>Checked in today</span>
            </div>
          )}
          {checkedIn === null && (
            <span className="text-xs text-muted-foreground font-mono">Loading attendance…</span>
          )}
        </div>
      </div>

      {/* COCKPIT ROW 1: Real Live Court Grid & Real Today Member Attendance */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Real Live Court Grid (7 cols) */}
        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs lg:col-span-7 flex flex-col justify-between">
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                <h2 className="text-sm font-semibold tracking-tight text-foreground">
                  Club Courts Status ({courts.length})
                </h2>
              </div>
              <Link
                href="/app/courts"
                className="text-xs font-medium text-primary hover:underline"
              >
                Book Court →
              </Link>
            </div>

            {courts.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground rounded-xl border border-dashed border-border/60 p-4">
                <p>No courts have been added to this club yet.</p>
                {isStaff && (
                  <Link href="/app/courts" className="text-primary font-medium hover:underline inline-block mt-1">
                    Add Courts in Court Manager →
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {courtsWithStatus.slice(0, 6).map((c) => (
                  <div
                    key={c.id}
                    className={`flex flex-col justify-between rounded-xl border p-3 text-xs transition-all ${
                      c.isOccupied
                        ? "border-primary/40 bg-primary/[0.04]"
                        : "border-border/60 bg-muted/20"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground text-xs">{c.name}</span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] font-mono font-semibold uppercase ${
                            c.isOccupied
                              ? "bg-primary/20 text-primary"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {c.isOccupied ? "Occupied" : "Available"}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {c.activeBooking?.notes || (c.activeBooking ? "Active player session" : `${c.type || "Synthetic"} Court`)}
                      </p>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between border-t border-border/40 pt-2 text-[10px] text-muted-foreground">
                      <span>{c.hourlyFee ? money(c.hourlyFee) + "/hr" : "Included"}</span>
                      {!c.isOccupied ? (
                        <Link href="/app/courts" className="font-semibold text-primary hover:underline">
                          Book Now
                        </Link>
                      ) : (
                        <span className="font-mono">In session</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Real Quick Member Attendance Today (5 cols) */}
        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs lg:col-span-5 flex flex-col justify-between">
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Today's Check-ins ({todayCheckedInRows.length})
              </h2>
              <Link href="/app/attendance" className="text-xs text-primary font-medium hover:underline">
                Full Matrix →
              </Link>
            </div>

            {todayCheckedInRows.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground rounded-xl border border-dashed border-border/60 p-4">
                <p>No players have checked in yet today.</p>
                <p className="text-[11px] mt-1 text-muted-foreground/80">
                  Check-ins will appear live here as members arrive at the club.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {todayCheckedInRows.slice(0, 5).map((member) => (
                  <div
                    key={member.userId}
                    className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 p-2.5 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar name={member.name} src={member.photoUrl} size={28} />
                      <span className="truncate font-medium text-foreground">{member.name}</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {member.checkInTime && (
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {new Date(member.checkInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                      <span className="rounded px-1.5 py-0.5 text-[9px] font-mono font-medium bg-primary/10 text-primary border border-primary/20">
                        {member.status === "LATE" ? "Late" : "Present"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* COCKPIT ROW 2: Real Recent Matches & Real Wallet Cashflow */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Real Completed Matches (6 cols) */}
        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs lg:col-span-6 flex flex-col justify-between">
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Recent Completed Matches
              </h2>
              <Link href="/app/matches" className="text-xs text-primary font-medium hover:underline">
                Score Match →
              </Link>
            </div>

            {recentMatches.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground rounded-xl border border-dashed border-border/60 p-4">
                <p>No completed matches logged yet in this club.</p>
                <Link href="/app/matches" className="text-primary font-medium hover:underline inline-block mt-1">
                  Start or Record a Match →
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {recentMatches.slice(0, 4).map((m) => {
                  const teamAName = m.teams[0]?.players.map((p) => p.user?.name || "Player").join(" & ") || "Team A";
                  const teamBName = m.teams[1]?.players.map((p) => p.user?.name || "Player").join(" & ") || "Team B";
                  const scoreLabel = m.scores && m.scores.length > 0
                    ? m.scores.map((s) => `${s.scoreA}-${s.scoreB}`).join(", ")
                    : "Final";

                  return (
                    <div
                      key={m.id}
                      className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 p-2.5 text-xs"
                    >
                      <div className="min-w-0 flex-1 pr-3">
                        <p className="truncate font-semibold text-foreground">{teamAName}</p>
                        <p className="truncate text-muted-foreground text-[11px]">vs {teamBName}</p>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        <span className="font-mono text-xs font-bold tabular-nums text-foreground bg-muted/60 px-2 py-0.5 rounded border border-border/60">
                          {scoreLabel}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground uppercase">
                          {m.type.toLowerCase()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Real Club Wallet / Personal Balance (6 cols) */}
        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs lg:col-span-6 flex flex-col justify-between">
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                {isStaff ? "Club Treasury Overview" : "Your Club Wallet"}
              </h2>
              <Link href="/app/wallet" className="text-xs text-primary font-medium hover:underline">
                Wallet Ledger →
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-center">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block">
                  {isStaff ? "Month Revenue" : "Credits"}
                </span>
                <p className="mt-1 text-sm font-bold font-mono text-primary tabular-nums">
                  {isStaff && adminStats
                    ? money(adminStats.finance.revenueThisMonth)
                    : money(wallet?.monthCredit ?? 0)}
                </p>
              </div>

              <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-center">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block">
                  {isStaff ? "Outstanding Dues" : "Pending Fines"}
                </span>
                <p className="mt-1 text-sm font-bold font-mono text-destructive tabular-nums">
                  {isStaff && adminStats
                    ? money(adminStats.finance.outstandingDues)
                    : money(wallet?.pendingDues ?? 0)}
                </p>
              </div>

              <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-center">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block">
                  {isStaff ? "Your Balance" : "Wallet Balance"}
                </span>
                <p className="mt-1 text-sm font-bold font-mono text-foreground tabular-nums">
                  {money(balance)}
                </p>
              </div>
            </div>

            {/* Upcoming Coaching Session snippet if user booked any */}
            {coachingBookings.length > 0 && (
              <div className="mt-3.5 rounded-xl border border-primary/20 bg-primary/5 p-2.5 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-muted-foreground">
                    Next Training: <strong className="text-foreground">{coachingBookings[0].coachName}</strong> ({coachingBookings[0].sessionDate})
                  </span>
                </div>
                <Link href="/app/coaching" className="text-[11px] font-semibold text-primary hover:underline">
                  View →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Real Player Personal Snapshot */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Your Performance Snapshot
        </h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Elo Rating"
            value={rating ? String(Math.round(rating.rating)) : "1000"}
            sub={
              rating && rating.monthlyDelta !== 0 ? (
                <span className={rating.monthlyDelta > 0 ? "text-primary font-mono" : "text-destructive font-mono"}>
                  {rating.monthlyDelta > 0 ? "+" : ""}
                  {Math.round(rating.monthlyDelta)} this month
                </span>
              ) : (
                <span className="text-muted-foreground font-mono">Unrated / Initial</span>
              )
            }
          />
          <StatCard
            label="Wallet Balance"
            value={money(balance)}
            sub={wallet && wallet.pendingDues > 0 ? `${money(wallet.pendingDues)} pending fines` : "No pending dues"}
          />
          <StatCard
            label="Attendance Rate"
            value={history.length > 0 ? `${ratePct}%` : "0%"}
            sub={
              history.length > 0
                ? `${attendedDays.length}/${history.length} sessions attended`
                : "No check-ins recorded yet"
            }
          />
          <StatCard
            label="Match Record"
            value={rating ? `${rating.wins}W – ${rating.losses}L` : "0W – 0L"}
            sub={rating && rating.wins + rating.losses > 0 ? `Win rate ${rating.winRate}%` : "No matches played yet"}
          />
        </div>
      </section>

      {/* Nearby Clubs Bar */}
      <NearbyClubsBar />

      {/* Play Groups Section */}
      <section className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
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

import { prisma } from "@/server/db";
import { dayKey, startOfDay, endOfDay, startOfMonth, startOfWeek, type PeriodKey } from "@/lib/date";
import { playerSummary, aggregateBy, attendanceSummary, type MatchRow } from "@/lib/engines/stats";
import { parseClubSettings } from "@/lib/constants";

export interface PlayerStatistics {
  overall: {
    played: number;
    wins: number;
    losses: number;
    winRate: number;
    form: ("W" | "L")[];
    avgPointsFor: number;
    avgPointsAgainst: number;
    avgPointDiff: number;
    bestWinStreak: number;
    worstLosingStreak: number;
    currentStreak: { type: "W" | "L"; count: number } | null;
  };
  attendance: ReturnType<typeof attendanceSummary>;
  rating?: {
    rating: number;
    monthlyDelta: number;
    consistency: number;
    winRate: number;
  };
  partners: (Agg & { name: string })[];
  opponents: (Agg & { name: string })[];
  recentMatches: {
    id: string;
    date: string;
    won: boolean;
    score: string;
    opponentNames: string[];
    partnerNames: string[];
  }[];
}

interface Agg {
  id: string;
  played: number;
  wins: number;
  winRate: number;
}

export async function playerStatistics(clubId: string, userId: string): Promise<PlayerStatistics> {
  const matches = await prisma.match.findMany({
    where: { clubId, status: "COMPLETED", players: { some: { userId } } },
    include: {
      teams: {
        include: { players: { include: { user: { select: { id: true, name: true } } } } }
      },
      scores: true
    },
    orderBy: { endedAt: "desc" },
    take: 200
  });

  const rows: MatchRow[] = [];
  const recentMatches: PlayerStatistics["recentMatches"] = [];

  for (const m of matches) {
    const myTeam = m.teams.find((t) => t.players.some((p) => p.userId === userId));
    const otherTeam = m.teams.find((t) => t.teamIndex !== myTeam?.teamIndex);
    if (!myTeam || !otherTeam) continue;
    const winnerIdx = m.winnerTeamIndex ?? -1;
    const won = myTeam.teamIndex === winnerIdx;
    const sortedScores = [...m.scores].sort((a, b) => a.setNumber - b.setNumber);
    const pointsFor = sortedScores.reduce((s, x) => s + (myTeam.teamIndex === 0 ? x.scoreA : x.scoreB), 0);
    const pointsAgainst = sortedScores.reduce((s, x) => s + (myTeam.teamIndex === 0 ? x.scoreB : x.scoreA), 0);
    rows.push({
      id: m.id,
      date: (m.endedAt ?? m.createdAt).toISOString(),
      won,
      doubles: m.type === "DOUBLES",
      pointsFor,
      pointsAgainst,
      partners: myTeam.players.filter((p) => p.userId !== userId).map((p) => p.userId),
      opponents: otherTeam.players.map((p) => p.userId)
    });
    if (recentMatches.length < 10) {
      recentMatches.push({
        id: m.id,
        date: (m.endedAt ?? m.createdAt).toISOString(),
        won,
        score: sortedScores.map((s) =>
          myTeam.teamIndex === 0 ? `${s.scoreA}-${s.scoreB}` : `${s.scoreB}-${s.scoreA}`
        ).join(", ") || (m.isWalkover ? "walkover" : ""),
        opponentNames: otherTeam.players.map((p) => p.user.name),
        partnerNames: myTeam.players.filter((p) => p.userId !== userId).map((p) => p.user.name)
      });
    }
  }

  const summary = playerSummary(rows);
  const now = new Date();
  const windowStart = new Date(now.getTime() - 30 * 86400000);
  const attendanceRecords = await prisma.attendanceRecord.findMany({
    where: { clubId, userId, createdAt: { gte: windowStart } }
  });
  const attendance = attendanceSummary(
    attendanceRecords.map((r) => ({ day: r.day, status: r.status })),
    30
  );

  const [ratingRow] = await Promise.all([prisma.playerRating.findUnique({ where: { clubId_userId: { clubId, userId } } })]);
  const monthHistory = await prisma.ratingHistory.findMany({
    where: { clubId, userId, createdAt: { gte: startOfMonth(now) } }
  });

  const nameIds = new Set<string>();
  for (const row of rows) {
    row.partners.forEach((p) => nameIds.add(p));
    row.opponents.forEach((o) => nameIds.add(o));
  }
  const users = await prisma.user.findMany({
    where: { id: { in: [...nameIds] } },
    select: { id: true, name: true }
  });
  const nameMap = new Map(users.map((u) => [u.id, u.name]));

  const toAgg = (map: Map<string, { key: string; played: number; wins: number; winRate: number }>) =>
    [...map.values()]
      .sort((a, b) => b.played - a.played || b.winRate - a.winRate)
      .slice(0, 8)
      .map((a) => ({ ...a, id: a.key, name: nameMap.get(a.key) ?? "Unknown" }));

  return {
    overall: {
      played: summary.played,
      wins: summary.wins,
      losses: summary.losses,
      winRate: summary.winRate,
      form: summary.form,
      avgPointsFor: summary.avgPointsFor,
      avgPointsAgainst: summary.avgPointsAgainst,
      avgPointDiff: summary.avgPointDiff,
      bestWinStreak: summary.streaks.bestWinStreak,
      worstLosingStreak: summary.streaks.worstLosingStreak,
      currentStreak: summary.streaks.current
    },
    attendance,
    rating: ratingRow
      ? {
          rating: Math.round(ratingRow.rating),
          monthlyDelta: Math.round(monthHistory.reduce((s, h) => s + h.delta, 0)),
          consistency: 75,
          winRate: ratingRow.matchesPlayed ? Math.round((ratingRow.wins / ratingRow.matchesPlayed) * 100) : 0
        }
      : undefined,
    partners: toAgg(aggregateBy(rows, "partners")),
    opponents: toAgg(aggregateBy(rows, "opponents")),
    recentMatches
  };
}

export async function clubDashboard(clubId: string) {
  const now = new Date();
  const today = dayKey(now);
  const monthStart = startOfMonth(now);
  const weekStart = startOfWeek(now);

  const [
    totalMembers,
    pendingRequests,
    todayRecords,
    activeMatches,
    courts,
    duesWallets,
    penaltiesWeek,
    revenueMonth,
    recentMatches,
    todayMatchesCount,
    bookingsToday
  ] = await Promise.all([
    prisma.clubMember.count({ where: { clubId, status: "ACTIVE" } }),
    prisma.clubMember.count({ where: { clubId, status: "PENDING" } }),
    prisma.attendanceRecord.count({ where: { clubId, day: today, status: { in: ["PRESENT", "LATE"] } } }),
    prisma.match.findMany({
      where: { clubId, status: "IN_PROGRESS" },
      include: { teams: { include: { players: { include: { user: { select: { name: true } } } } } } },
      take: 6
    }),
    prisma.court.findMany({ where: { clubId, deletedAt: null } }),
    prisma.wallet.aggregate({ where: { clubId, balance: { lt: 0 } }, _sum: { balance: true }, _count: true }),
    prisma.penalty.findMany({ where: { clubId, createdAt: { gte: weekStart } }, select: { amount: true } }),
    prisma.walletTransaction.aggregate({
      where: { clubId, amount: { gt: 0 }, createdAt: { gte: monthStart } },
      _sum: { amount: true }
    }),
    recentCompleted(clubId),
    matchCountToday(clubId),
    bookingCountToday(clubId)
  ]);

  const availableCourts = await prisma.match.count({ where: { clubId, status: "IN_PROGRESS", courtId: { not: null } } });
  void availableCourts;

  return {
    members: { total: totalMembers, pending: pendingRequests },
    attendance: { presentToday: todayRecords },
    matches: {
      live: activeMatches.map((m) => ({
        id: m.id,
        court: m.courtId,
        label: m.teams.map((t) => t.players.map((p) => p.user.name).join(" & ")).join(" vs ")
      })),
      todayCount: todayMatchesCount
    },
    courts: {
      total: courts.length,
      available: courts.filter((c) => c.status === "AVAILABLE").length,
      maintenance: courts.filter((c) => c.status === "MAINTENANCE").length
    },
    finance: {
      outstandingDues: Math.abs(duesWallets._sum.balance ?? 0),
      membersInDues: duesWallets._count,
      revenueThisMonth: revenueMonth._sum.amount ?? 0,
      penaltiesThisWeek: penaltiesWeek.reduce((s, p) => s + p.amount, 0)
    },
    bookingsToday: bookingsToday,
    recentActivity: await auditPreview(clubId)
  };
}

export async function coachOverview(clubId: string) {
  const members = await prisma.clubMember.findMany({
    where: { clubId, status: "ACTIVE", role: "PLAYER" },
    include: { user: { select: { id: true, name: true, photoUrl: true, skillLevel: true } } },
    take: 60
  });
  const ratings = await prisma.playerRating.findMany({ where: { clubId } });
  const ratingMap = new Map(ratings.map((r) => [r.userId, r]));
  return members.map((m) => {
    const r = ratingMap.get(m.userId);
    return {
      user: m.user,
      role: m.role,
      rating: r ? Math.round(r.rating) : 1000,
      played: r?.matchesPlayed ?? 0,
      winRate: r && r.matchesPlayed ? Math.round((r.wins / r.matchesPlayed) * 100) : 0,
      lastPlayedAt: r?.lastPlayedAt ?? null
    };
  });
}

export async function leaderboardPeriodDefault(): Promise<PeriodKey> {
  return "MONTHLY";
}

async function recentCompleted(clubId: string) {
  const items = await prisma.match.findMany({
    where: { clubId, status: "COMPLETED" },
    orderBy: { endedAt: "desc" },
    take: 5,
    include: { teams: { include: { players: { include: { user: { select: { name: true } } } } }, }, scores: true }
  });
  return items.map((m) => ({
    id: m.id,
    when: m.endedAt,
    label: m.teams.map((t) => t.players.map((p) => p.user.name).join(" & ")).join(" vs "),
    score: [...m.scores]
      .sort((a, b) => a.setNumber - b.setNumber)
      .map((s) => `${s.scoreA}-${s.scoreB}`)
      .join(", ")
  }));
}

async function matchCountToday(clubId: string) {
  const from = startOfDay();
  const to = endOfDay();
  return prisma.match.count({
    where: { clubId, OR: [{ createdAt: { gte: from, lt: to } }, { startedAt: { gte: from, lt: to } }] }
  });
}

async function bookingCountToday(clubId: string) {
  const from = startOfDay();
  const to = endOfDay();
  return prisma.courtBooking.count({
    where: { clubId, startTime: { gte: from, lt: to }, status: { not: "CANCELLED" } }
  });
}

async function auditPreview(clubId: string) {
  const logs = await prisma.auditLog.findMany({
    where: { clubId },
    orderBy: { createdAt: "desc" },
    take: 8,
    include: { actor: { select: { name: true } } }
  });
  return logs.map((l) => ({
    action: l.action,
    by: l.actor?.name ?? "System",
    at: l.createdAt,
    entityType: l.entityType
  }));
}

export async function clubSettingsFor(club: { settings: string }) {
  return parseClubSettings(club.settings);
}

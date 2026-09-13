import {
  matches,
  matchPlayers,
  matchTeams,
  matchScores,
  attendanceRecords,
  playerRatings,
  ratingHistories,
  users,
  clubMembers,
  courts,
  wallets,
  penalties,
  walletTransactions,
  courtBookings,
  auditLogs
} from "@/server/db";
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
  const userMatches = await matchPlayers().find({ userId }).toArray();
  const userMatchIds = Array.from(new Set(userMatches.map((m) => m.matchId as string)));

  const matchDocs = await matches()
    .find({
      id: { $in: userMatchIds },
      clubId,
      status: "COMPLETED"
    })
    .sort({ endedAt: -1 })
    .limit(200)
    .toArray();

  const matchIds = matchDocs.map((m) => m.id as string);

  const [allTeams, allPlayers, allScores] = await Promise.all([
    matchTeams().find({ matchId: { $in: matchIds } }).toArray(),
    matchPlayers().find({ matchId: { $in: matchIds } }).toArray(),
    matchScores().find({ matchId: { $in: matchIds } }).toArray()
  ]);

  const playerUserIds = Array.from(new Set(allPlayers.map((p) => p.userId as string)));
  const playerUsers = await users()
    .find({ id: { $in: playerUserIds } }, { projection: { id: 1, name: 1 } })
    .toArray();
  const userNameMap = new Map(playerUsers.map((u) => [u.id as string, u.name as string]));

  const teamsByMatch = new Map<string, any[]>();
  for (const t of allTeams) {
    const list = teamsByMatch.get(t.matchId as string) || [];
    list.push(t);
    teamsByMatch.set(t.matchId as string, list);
  }

  const playersByMatchTeam = new Map<string, any[]>();
  for (const p of allPlayers) {
    const key = `${p.matchId}:${p.teamIndex}`;
    const list = playersByMatchTeam.get(key) || [];
    list.push({ ...p, user: { id: p.userId, name: userNameMap.get(p.userId as string) || "Unknown" } });
    playersByMatchTeam.set(key, list);
  }

  const scoresByMatch = new Map<string, any[]>();
  for (const s of allScores) {
    const list = scoresByMatch.get(s.matchId as string) || [];
    list.push(s);
    scoresByMatch.set(s.matchId as string, list);
  }

  const rows: MatchRow[] = [];
  const recentMatches: PlayerStatistics["recentMatches"] = [];

  for (const m of matchDocs) {
    const mTeams = (teamsByMatch.get(m.id as string) || []).map((t) => ({
      ...t,
      players: playersByMatchTeam.get(`${m.id}:${t.teamIndex}`) || []
    }));
    const mScores = scoresByMatch.get(m.id as string) || [];

    const myTeam = mTeams.find((t) => t.players.some((p: any) => p.userId === userId));
    const otherTeam = mTeams.find((t) => t.teamIndex !== myTeam?.teamIndex);
    if (!myTeam || !otherTeam) continue;

    const winnerIdx = m.winnerTeamIndex ?? -1;
    const won = myTeam.teamIndex === winnerIdx;
    const sortedScores = [...mScores].sort((a, b) => (a.setNumber as number) - (b.setNumber as number));
    const pointsFor = sortedScores.reduce((s, x) => s + (myTeam.teamIndex === 0 ? (x.scoreA as number) : (x.scoreB as number)), 0);
    const pointsAgainst = sortedScores.reduce((s, x) => s + (myTeam.teamIndex === 0 ? (x.scoreB as number) : (x.scoreA as number)), 0);

    const endedOrCreated = (m.endedAt ?? m.createdAt) as Date;
    rows.push({
      id: m.id as string,
      date: endedOrCreated.toISOString(),
      won,
      doubles: m.type === "DOUBLES",
      pointsFor,
      pointsAgainst,
      partners: myTeam.players.filter((p: any) => p.userId !== userId).map((p: any) => p.userId as string),
      opponents: otherTeam.players.map((p: any) => p.userId as string)
    });

    if (recentMatches.length < 10) {
      recentMatches.push({
        id: m.id as string,
        date: endedOrCreated.toISOString(),
        won,
        score:
          sortedScores
            .map((s) => (myTeam.teamIndex === 0 ? `${s.scoreA}-${s.scoreB}` : `${s.scoreB}-${s.scoreA}`))
            .join(", ") || (m.isWalkover ? "walkover" : ""),
        opponentNames: otherTeam.players.map((p: any) => p.user.name),
        partnerNames: myTeam.players.filter((p: any) => p.userId !== userId).map((p: any) => p.user.name)
      });
    }
  }

  const summary = playerSummary(rows);
  const now = new Date();
  const windowStart = new Date(now.getTime() - 30 * 86400000);
  const attDocs = await attendanceRecords()
    .find({ clubId, userId, createdAt: { $gte: windowStart } })
    .toArray();

  const attendance = attendanceSummary(
    attDocs.map((r) => ({ day: r.day as string, status: r.status as any })),
    30
  );

  const [ratingRow, monthHistory] = await Promise.all([
    playerRatings().findOne({ clubId, userId }),
    ratingHistories()
      .find({ clubId, userId, createdAt: { $gte: startOfMonth(now) } })
      .toArray()
  ]);

  const nameIds = new Set<string>();
  for (const row of rows) {
    row.partners.forEach((p) => nameIds.add(p));
    row.opponents.forEach((o) => nameIds.add(o));
  }

  const missingNameIds = Array.from(nameIds).filter((id) => !userNameMap.has(id));
  if (missingNameIds.length > 0) {
    const extraUsers = await users()
      .find({ id: { $in: missingNameIds } }, { projection: { id: 1, name: 1 } })
      .toArray();
    for (const u of extraUsers) {
      userNameMap.set(u.id as string, u.name as string);
    }
  }

  const toAgg = (map: Map<string, { key: string; played: number; wins: number; winRate: number }>) =>
    [...map.values()]
      .sort((a, b) => b.played - a.played || b.winRate - a.winRate)
      .slice(0, 8)
      .map((a) => ({ ...a, id: a.key, name: userNameMap.get(a.key) ?? "Unknown" }));

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
          rating: Math.round(ratingRow.rating as number),
          monthlyDelta: Math.round(monthHistory.reduce((s, h) => s + (Number(h.delta) || 0), 0)),
          consistency: 75,
          winRate: ratingRow.matchesPlayed ? Math.round(((ratingRow.wins as number) / (ratingRow.matchesPlayed as number)) * 100) : 0
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
    activeMatchesRaw,
    courtsList,
    duesWalletsAgg,
    penaltiesWeek,
    revenueMonthAgg,
    recentMatchesList,
    todayMatchesCount,
    bookingsToday
  ] = await Promise.all([
    clubMembers().countDocuments({ clubId, status: "ACTIVE" }),
    clubMembers().countDocuments({ clubId, status: "PENDING" }),
    attendanceRecords().countDocuments({ clubId, day: today, status: { $in: ["PRESENT", "LATE"] } }),
    matches().find({ clubId, status: "IN_PROGRESS" }).limit(6).toArray(),
    courts().find({ clubId, deletedAt: null }).toArray(),
    wallets().aggregate([
      { $match: { clubId, balance: { $lt: 0 } } },
      { $group: { _id: null, balance: { $sum: "$balance" }, count: { $sum: 1 } } }
    ]).toArray(),
    penalties().find({ clubId, createdAt: { $gte: weekStart } }, { projection: { amount: 1 } }).toArray(),
    walletTransactions().aggregate([
      { $match: { clubId, amount: { $gt: 0 }, createdAt: { $gte: monthStart } } },
      { $group: { _id: null, amount: { $sum: "$amount" } } }
    ]).toArray(),
    recentCompleted(clubId),
    matchCountToday(clubId),
    bookingCountToday(clubId)
  ]);

  const activeMatchIds = activeMatchesRaw.map((m) => m.id as string);
  const [activeTeams, activePlayers] = activeMatchIds.length > 0
    ? await Promise.all([
        matchTeams().find({ matchId: { $in: activeMatchIds } }).toArray(),
        matchPlayers().find({ matchId: { $in: activeMatchIds } }).toArray()
      ])
    : [[], []];

  const activeUserIds = Array.from(new Set(activePlayers.map((p) => p.userId as string)));
  const activeUsers = activeUserIds.length > 0
    ? await users().find({ id: { $in: activeUserIds } }, { projection: { id: 1, name: 1 } }).toArray()
    : [];
  const userNameMap = new Map(activeUsers.map((u) => [u.id as string, u.name as string]));

  const teamsByMatch = new Map<string, any[]>();
  for (const t of activeTeams) {
    const list = teamsByMatch.get(t.matchId as string) || [];
    list.push(t);
    teamsByMatch.set(t.matchId as string, list);
  }

  const playersByTeamKey = new Map<string, any[]>();
  for (const p of activePlayers) {
    const key = `${p.matchId}:${p.teamIndex}`;
    const list = playersByTeamKey.get(key) || [];
    list.push({ ...p, user: { name: userNameMap.get(p.userId as string) || "Unknown" } });
    playersByTeamKey.set(key, list);
  }

  const liveMatches = activeMatchesRaw.map((m) => {
    const mTeams = (teamsByMatch.get(m.id as string) || []).map((t) => ({
      ...t,
      players: playersByTeamKey.get(`${m.id}:${t.teamIndex}`) || []
    }));
    return {
      id: m.id as string,
      court: m.courtId,
      label: mTeams.map((t) => t.players.map((p: any) => p.user.name).join(" & ")).join(" vs ")
    };
  });

  const duesRow = duesWalletsAgg[0] || { balance: 0, count: 0 };
  const revenueRow = revenueMonthAgg[0] || { amount: 0 };

  return {
    members: { total: totalMembers, pending: pendingRequests },
    attendance: { presentToday: todayRecords },
    matches: {
      live: liveMatches,
      todayCount: todayMatchesCount
    },
    courts: {
      total: courtsList.length,
      available: courtsList.filter((c) => c.status === "AVAILABLE").length,
      maintenance: courtsList.filter((c) => c.status === "MAINTENANCE").length
    },
    finance: {
      outstandingDues: Math.abs(duesRow.balance ?? 0),
      membersInDues: duesRow.count ?? 0,
      revenueThisMonth: revenueRow.amount ?? 0,
      penaltiesThisWeek: penaltiesWeek.reduce((s, p) => s + (Number(p.amount) || 0), 0)
    },
    bookingsToday,
    recentActivity: await auditPreview(clubId)
  };
}

export async function coachOverview(clubId: string) {
  const members = await clubMembers().find({
    clubId,
    status: "ACTIVE",
    role: "PLAYER"
  }).limit(60).toArray();

  const userIds = members.map((m) => m.userId as string);
  const [memberUsers, ratings] = await Promise.all([
    users().find({ id: { $in: userIds } }, { projection: { id: 1, name: 1, photoUrl: 1, skillLevel: 1 } }).toArray(),
    playerRatings().find({ clubId }).toArray()
  ]);

  const userMap = new Map(memberUsers.map((u) => [u.id as string, u]));
  const ratingMap = new Map(ratings.map((r) => [r.userId as string, r]));

  return members.map((m) => {
    const u = userMap.get(m.userId as string);
    const r = ratingMap.get(m.userId as string);
    return {
      user: u ? { id: u.id, name: u.name, photoUrl: u.photoUrl, skillLevel: u.skillLevel } : null,
      role: m.role,
      rating: r ? Math.round(r.rating as number) : 1000,
      played: (r?.matchesPlayed as number) ?? 0,
      winRate: r && (r.matchesPlayed as number) ? Math.round(((r.wins as number) / (r.matchesPlayed as number)) * 100) : 0,
      lastPlayedAt: r?.lastPlayedAt ?? null
    };
  });
}

export async function leaderboardPeriodDefault(): Promise<PeriodKey> {
  return "MONTHLY";
}

async function recentCompleted(clubId: string) {
  const items = await matches().find({ clubId, status: "COMPLETED" }).sort({ endedAt: -1 }).limit(5).toArray();
  const matchIds = items.map((m) => m.id as string);
  if (matchIds.length === 0) return [];

  const [allTeams, allPlayers, allScores] = await Promise.all([
    matchTeams().find({ matchId: { $in: matchIds } }).toArray(),
    matchPlayers().find({ matchId: { $in: matchIds } }).toArray(),
    matchScores().find({ matchId: { $in: matchIds } }).toArray()
  ]);

  const userIds = Array.from(new Set(allPlayers.map((p) => p.userId as string)));
  const usersList = await users().find({ id: { $in: userIds } }, { projection: { id: 1, name: 1 } }).toArray();
  const userNameMap = new Map(usersList.map((u) => [u.id as string, u.name as string]));

  const teamsByMatch = new Map<string, any[]>();
  for (const t of allTeams) {
    const list = teamsByMatch.get(t.matchId as string) || [];
    list.push(t);
    teamsByMatch.set(t.matchId as string, list);
  }

  const playersByTeamKey = new Map<string, any[]>();
  for (const p of allPlayers) {
    const key = `${p.matchId}:${p.teamIndex}`;
    const list = playersByTeamKey.get(key) || [];
    list.push({ ...p, user: { name: userNameMap.get(p.userId as string) || "Unknown" } });
    playersByTeamKey.set(key, list);
  }

  const scoresByMatch = new Map<string, any[]>();
  for (const s of allScores) {
    const list = scoresByMatch.get(s.matchId as string) || [];
    list.push(s);
    scoresByMatch.set(s.matchId as string, list);
  }

  return items.map((m) => {
    const mTeams = (teamsByMatch.get(m.id as string) || []).map((t) => ({
      ...t,
      players: playersByTeamKey.get(`${m.id}:${t.teamIndex}`) || []
    }));
    const mScores = scoresByMatch.get(m.id as string) || [];
    return {
      id: m.id as string,
      when: m.endedAt,
      label: mTeams.map((t) => t.players.map((p: any) => p.user.name).join(" & ")).join(" vs "),
      score: [...mScores]
        .sort((a, b) => (a.setNumber as number) - (b.setNumber as number))
        .map((s) => `${s.scoreA}-${s.scoreB}`)
        .join(", ")
    };
  });
}

async function matchCountToday(clubId: string) {
  const from = startOfDay();
  const to = endOfDay();
  return matches().countDocuments({
    clubId,
    $or: [{ createdAt: { $gte: from, $lt: to } }, { startedAt: { $gte: from, $lt: to } }]
  });
}

async function bookingCountToday(clubId: string) {
  const from = startOfDay();
  const to = endOfDay();
  return courtBookings().countDocuments({
    clubId,
    startTime: { $gte: from, $lt: to },
    status: { $ne: "CANCELLED" }
  });
}

async function auditPreview(clubId: string) {
  const logs = await auditLogs().find({ clubId }).sort({ createdAt: -1 }).limit(8).toArray();
  const actorIds = Array.from(new Set(logs.map((l) => l.actorUserId as string).filter(Boolean)));
  const actorUsers = actorIds.length > 0
    ? await users().find({ id: { $in: actorIds } }, { projection: { id: 1, name: 1 } }).toArray()
    : [];
  const actorMap = new Map(actorUsers.map((u) => [u.id as string, u.name as string]));

  return logs.map((l) => ({
    action: l.action as string,
    by: (l.actorUserId ? actorMap.get(l.actorUserId as string) : null) ?? "System",
    at: l.createdAt as Date,
    entityType: l.entityType as string
  }));
}

export async function clubSettingsFor(club: { settings: string }) {
  return parseClubSettings(club.settings);
}

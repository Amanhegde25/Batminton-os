import { prisma } from "@/server/db";
import { dayKey, periodRange, type PeriodKey } from "@/lib/date";
import { computeStreaks } from "@/lib/engines/stats";

export const LEADERBOARD_CATEGORIES = [
  "BEST_PLAYER",
  "MOST_IMPROVED",
  "HIGHEST_RATING",
  "HIGHEST_WIN_RATE",
  "ATTENDANCE_CHAMPION",
  "LONGEST_WINNING_STREAK",
  "MOST_MATCHES",
  "BEST_DOUBLES"
] as const;
export type LeaderboardCategory = (typeof LEADERBOARD_CATEGORIES)[number];

export interface LeaderboardEntry {
  userId: string;
  name: string;
  photoUrl: string | null;
  value: number;
  display: string;
  meta?: string;
}

export async function getLeaderboard(
  clubId: string,
  category: LeaderboardCategory,
  period: PeriodKey
): Promise<LeaderboardEntry[]> {
  const { from } = periodRange(period);
  const dateFilter = from ? { gte: from } : undefined;

  if (category === "HIGHEST_RATING") {
    const ratings = await prisma.playerRating.findMany({
      where: { clubId },
      orderBy: { rating: "desc" },
      take: 10,
      include: { user: { select: { name: true, photoUrl: true } } }
    });
    return ratings.map((r) => ({
      userId: r.userId,
      name: r.user.name,
      photoUrl: r.user.photoUrl,
      value: Math.round(r.rating),
      display: `${Math.round(r.rating)}`
    }));
  }

  if (category === "ATTENDANCE_CHAMPION") {
    const records = await prisma.attendanceRecord.groupBy({
      by: ["userId"],
      where: {
        clubId,
        status: { in: ["PRESENT", "LATE"] },
        ...(from ? { day: { gte: dayKey(from) } } : {})
      },
      _count: { _all: true }
    });
    const users = await usersFor(clubId, records.map((r) => r.userId));
    return sortEntries(
      records.map((r) => ({
        userId: r.userId,
        ...users[r.userId],
        value: r._count._all,
        display: `${r._count._all} days`
      })),
      10
    );
  }

  if (category === "MOST_IMPROVED") {
    const agg = await prisma.ratingHistory.groupBy({
      by: ["userId"],
      where: { clubId, ...(from ? { createdAt: dateFilter } : {}) },
      _sum: { delta: true }
    });
    const filtered = agg.filter((a) => (a._sum.delta ?? 0) !== 0);
    const users = await usersFor(clubId, filtered.map((f) => f.userId));
    return sortEntries(
      filtered.map((f) => ({
        userId: f.userId,
        ...users[f.userId],
        value: Math.round(f._sum.delta ?? 0),
        display: `${Math.round(f._sum.delta ?? 0) >= 0 ? "+" : ""}${Math.round(f._sum.delta ?? 0)}`
      })),
      10
    );
  }

  const matches = await prisma.match.findMany({
    where: {
      clubId,
      status: "COMPLETED",
      ...(from ? { endedAt: dateFilter } : {})
    },
    include: {
      teams: { include: { players: true } },
      scores: true
    }
  });

  interface Row {
    played: number;
    wins: number;
    doublesPlayed: number;
    doublesWins: number;
    dates: boolean[];
  }
  const rows = new Map<string, Row>();
  const ensure = (id: string): Row => {
    let r = rows.get(id);
    if (!r) {
      r = { played: 0, wins: 0, doublesPlayed: 0, doublesWins: 0, dates: [] };
      rows.set(id, r);
    }
    return r;
  };

  for (const m of matches) {
    const winnerIdx = m.winnerTeamIndex ?? -1;
    for (const team of m.teams) {
      const won = team.teamIndex === winnerIdx;
      for (const p of team.players) {
        const row = ensure(p.userId);
        row.played += 1;
        row.dates.push(won);
        if (won) row.wins += 1;
        if (m.type === "DOUBLES") {
          row.doublesPlayed += 1;
          if (won) row.doublesWins += 1;
        }
      }
    }
  }

  const ids = [...rows.keys()];
  const users = await usersFor(clubId, ids);

  switch (category) {
    case "BEST_PLAYER": {
      return sortEntries(
        ids.map((id) => {
          const r = rows.get(id)!;
          const winRate = r.played ? r.wins / r.played : 0;
          const score = Math.round(winRate * 60 + Math.log2(r.played + 1) * 40);
          return { userId: id, ...users[id], value: score, display: `${score}`, meta: `${r.wins}/${r.played}` };
        }),
        10
      );
    }
    case "HIGHEST_WIN_RATE": {
      return sortEntries(
        ids
          .filter((id) => rows.get(id)!.played >= 3)
          .map((id) => {
            const r = rows.get(id)!;
            return {
              userId: id,
              ...users[id],
              value: Math.round((r.wins / r.played) * 100),
              display: `${Math.round((r.wins / r.played) * 100)}%`,
              meta: `${r.wins}/${r.played}`
            };
          }),
        10
      );
    }
    case "LONGEST_WINNING_STREAK": {
      return sortEntries(
        ids.map((id) => {
          const r = rows.get(id)!;
          const streaks = computeStreaks(r.dates);
          return {
            userId: id,
            ...users[id],
            value: streaks.bestWinStreak,
            display: `${streaks.bestWinStreak} in a row`
          };
        }),
        10
      );
    }
    case "MOST_MATCHES": {
      return sortEntries(
        ids.map((id) => {
          const r = rows.get(id)!;
          return { userId: id, ...users[id], value: r.played, display: `${r.played} played` };
        }),
        10
      );
    }
    case "BEST_DOUBLES": {
      return sortEntries(
        ids
          .filter((id) => rows.get(id)!.doublesPlayed >= 3)
          .map((id) => {
            const r = rows.get(id)!;
            return {
              userId: id,
              ...users[id],
              value: Math.round((r.doublesWins / r.doublesPlayed) * 100),
              display: `${Math.round((r.doublesWins / r.doublesPlayed) * 100)}%`,
              meta: `${r.doublesWins}/${r.doublesPlayed}`
            };
          }),
        10
      );
    }
    default:
      return [];
  }
}

function sortEntries(entries: LeaderboardEntry[], take: number): LeaderboardEntry[] {
  return entries.sort((a, b) => b.value - a.value).slice(0, take);
}

async function usersFor(clubId: string, userIds: string[]): Promise<Record<string, { name: string; photoUrl: string | null }>> {
  if (userIds.length === 0) return {};
  const members = await prisma.clubMember.findMany({
    where: { clubId, userId: { in: userIds } },
    include: { user: { select: { id: true, name: true, photoUrl: true } } }
  });
  const map: Record<string, { name: string; photoUrl: string | null }> = {};
  for (const m of members) map[m.userId] = { name: m.user.name, photoUrl: m.user.photoUrl };
  for (const id of userIds) if (!map[id]) map[id] = { name: "Unknown", photoUrl: null };
  return map;
}

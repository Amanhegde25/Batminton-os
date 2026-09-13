import { playerRatings, attendanceRecords, ratingHistories, matches, matchTeams, matchPlayers, clubMembers } from "@/server/db";
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

  if (category === "HIGHEST_RATING") {
    const ratings = await playerRatings().aggregate([
      { $match: { clubId } },
      { $sort: { rating: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "users", let: { uid: "$userId" },
          pipeline: [{ $match: { $expr: { $eq: ["$id", "$$uid"] } } }, { $project: { name: 1, photoUrl: 1, _id: 0 } }],
          as: "user"
        }
      },
      { $unwind: "$user" }
    ]).toArray();
    return ratings.map((r) => ({
      userId: r.userId as string,
      name: (r.user as any).name,
      photoUrl: (r.user as any).photoUrl,
      value: Math.round(r.rating as number),
      display: `${Math.round(r.rating as number)}`
    }));
  }

  if (category === "ATTENDANCE_CHAMPION") {
    const matchFilter: Record<string, unknown> = { clubId, status: { $in: ["PRESENT", "LATE"] } };
    if (from) matchFilter.day = { $gte: dayKey(from) };
    const records = await attendanceRecords().aggregate([
      { $match: matchFilter },
      { $group: { _id: "$userId", count: { $sum: 1 } } }
    ]).toArray();
    const userIds = records.map((r) => r._id as string);
    const usersMap = await usersFor(clubId, userIds);
    return sortEntries(
      records.map((r) => ({
        userId: r._id as string,
        ...usersMap[r._id as string],
        value: r.count as number,
        display: `${r.count} days`
      })),
      10
    );
  }

  if (category === "MOST_IMPROVED") {
    const histFilter: Record<string, unknown> = { clubId };
    if (from) histFilter.createdAt = { $gte: from };
    const agg = await ratingHistories().aggregate([
      { $match: histFilter },
      { $group: { _id: "$userId", delta: { $sum: "$delta" } } }
    ]).toArray();
    const filtered = agg.filter((a) => (a.delta as number) !== 0);
    const usersMap = await usersFor(clubId, filtered.map((f) => f._id as string));
    return sortEntries(
      filtered.map((f) => ({
        userId: f._id as string,
        ...usersMap[f._id as string],
        value: Math.round(f.delta as number),
        display: `${Math.round(f.delta as number) >= 0 ? "+" : ""}${Math.round(f.delta as number)}`
      })),
      10
    );
  }

  // For match-based categories, load matches
  const matchFilter: Record<string, unknown> = { clubId, status: "COMPLETED" };
  if (from) matchFilter.endedAt = { $gte: from };
  const allMatches = await matches().find(matchFilter).toArray();
  const matchIds = allMatches.map((m) => m.id as string);
  const allTeams = await matchTeams().find({ matchId: { $in: matchIds } }).toArray();
  const allPlayers = await matchPlayers().find({ matchId: { $in: matchIds } }).toArray();

  interface Row { played: number; wins: number; doublesPlayed: number; doublesWins: number; dates: boolean[] }
  const rows = new Map<string, Row>();
  const ensure = (id: string): Row => {
    let r = rows.get(id);
    if (!r) { r = { played: 0, wins: 0, doublesPlayed: 0, doublesWins: 0, dates: [] }; rows.set(id, r); }
    return r;
  };

  for (const m of allMatches) {
    const mTeams = allTeams.filter((t) => t.matchId === m.id);
    const winnerIdx = (m.winnerTeamIndex as number) ?? -1;
    for (const team of mTeams) {
      const won = (team.teamIndex as number) === winnerIdx;
      const teamPlayers = allPlayers.filter((p) => p.teamId === team.id);
      for (const p of teamPlayers) {
        const row = ensure(p.userId as string);
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
  const usersMap = await usersFor(clubId, ids);

  switch (category) {
    case "BEST_PLAYER":
      return sortEntries(
        ids.map((id) => {
          const r = rows.get(id)!;
          const winRate = r.played ? r.wins / r.played : 0;
          const score = Math.round(winRate * 60 + Math.log2(r.played + 1) * 40);
          return { userId: id, ...usersMap[id], value: score, display: `${score}`, meta: `${r.wins}/${r.played}` };
        }), 10
      );
    case "HIGHEST_WIN_RATE":
      return sortEntries(
        ids.filter((id) => rows.get(id)!.played >= 3).map((id) => {
          const r = rows.get(id)!;
          return { userId: id, ...usersMap[id], value: Math.round((r.wins / r.played) * 100), display: `${Math.round((r.wins / r.played) * 100)}%`, meta: `${r.wins}/${r.played}` };
        }), 10
      );
    case "LONGEST_WINNING_STREAK":
      return sortEntries(
        ids.map((id) => {
          const r = rows.get(id)!;
          const streaks = computeStreaks(r.dates);
          return { userId: id, ...usersMap[id], value: streaks.bestWinStreak, display: `${streaks.bestWinStreak} in a row` };
        }), 10
      );
    case "MOST_MATCHES":
      return sortEntries(
        ids.map((id) => {
          const r = rows.get(id)!;
          return { userId: id, ...usersMap[id], value: r.played, display: `${r.played} played` };
        }), 10
      );
    case "BEST_DOUBLES":
      return sortEntries(
        ids.filter((id) => rows.get(id)!.doublesPlayed >= 3).map((id) => {
          const r = rows.get(id)!;
          return { userId: id, ...usersMap[id], value: Math.round((r.doublesWins / r.doublesPlayed) * 100), display: `${Math.round((r.doublesWins / r.doublesPlayed) * 100)}%`, meta: `${r.doublesWins}/${r.doublesPlayed}` };
        }), 10
      );
    default:
      return [];
  }
}

function sortEntries(entries: LeaderboardEntry[], take: number): LeaderboardEntry[] {
  return entries.sort((a, b) => b.value - a.value).slice(0, take);
}

async function usersFor(clubId: string, userIds: string[]): Promise<Record<string, { name: string; photoUrl: string | null }>> {
  if (userIds.length === 0) return {};
  const members = await clubMembers().aggregate([
    { $match: { clubId, userId: { $in: userIds } } },
    {
      $lookup: {
        from: "users", let: { uid: "$userId" },
        pipeline: [{ $match: { $expr: { $eq: ["$id", "$$uid"] } } }, { $project: { id: 1, name: 1, photoUrl: 1, _id: 0 } }],
        as: "user"
      }
    },
    { $unwind: "$user" }
  ]).toArray();
  const map: Record<string, { name: string; photoUrl: string | null }> = {};
  for (const m of members) map[m.userId as string] = { name: (m.user as any).name, photoUrl: (m.user as any).photoUrl };
  for (const id of userIds) if (!map[id]) map[id] = { name: "Unknown", photoUrl: null };
  return map;
}

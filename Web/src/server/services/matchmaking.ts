import { clubs, clubMembers, attendanceRecords, playerRatings, matches, matchPlayers, matchTeams, courtBookings, courts } from "@/server/db";
import { ApiError } from "@/lib/api";
import { generateSchedule, type MMPlayer } from "@/lib/engines/matchmaking";
import { dayKey } from "@/lib/date";
import { parseClubSettings } from "@/lib/constants";

export interface MatchmakingOptions {
  includeAbsent?: boolean;
  extraPlayerIds?: string[];
}

export async function buildAvailability(clubId: string, options?: MatchmakingOptions) {
  const club = await clubs().findOne({ id: clubId, deletedAt: null });
  if (!club) throw ApiError.notFound("Club not found");
  const settings = parseClubSettings(club.settings as string);
  const allowAbsent = settings.matchmaking?.allowAbsent ?? false;

  const today = dayKey();
  const checkedInRecords = await attendanceRecords().find(
    { clubId, day: today, status: { $in: ["PRESENT", "LATE"] } }
  ).sort({ createdAt: 1 }).toArray();
  const checkedInUserIds = new Set(checkedInRecords.map((r) => r.userId as string));

  const allActiveMembers = await clubMembers().aggregate([
    { $match: { clubId, status: "ACTIVE" } },
    {
      $lookup: {
        from: "users", let: { uid: "$userId" },
        pipeline: [{ $match: { $expr: { $eq: ["$id", "$$uid"] } } }, { $project: { id: 1, name: 1, photoUrl: 1, _id: 0 } }],
        as: "user"
      }
    },
    { $unwind: "$user" }
  ]).toArray();

  const absentMembers = allActiveMembers.filter((m) => !checkedInUserIds.has(m.userId as string));

  const requestingAbsent = options?.includeAbsent || (options?.extraPlayerIds && options.extraPlayerIds.length > 0);
  if (requestingAbsent && !allowAbsent) {
    throw ApiError.forbidden("Adding absent players to matchmaking is not allowed by club settings");
  }

  const includeAllAbsent = allowAbsent && Boolean(options?.includeAbsent);
  const extraSet = allowAbsent && options?.extraPlayerIds?.length ? new Set(options.extraPlayerIds) : new Set<string>();

  const eligibleMembers = allActiveMembers.filter((m) => {
    if (checkedInUserIds.has(m.userId as string)) return true;
    if (includeAllAbsent) return true;
    if (extraSet.has(m.userId as string)) return true;
    return false;
  });

  const ratings = await playerRatings().find({ clubId, userId: { $in: allActiveMembers.map((m) => m.userId as string) } }).toArray();
  const ratingMap = new Map(ratings.map((r) => [r.userId as string, r.rating as number]));

  const matchesToday = await matches().find({
    clubId,
    status: { $in: ["IN_PROGRESS", "COMPLETED"] },
    createdAt: { $gte: new Date(`${today}T00:00:00`) }
  }).toArray();
  const todayMatchIds = matchesToday.map((m) => m.id as string);
  const todayPlayers = await matchPlayers().find({ matchId: { $in: todayMatchIds } }).toArray();
  const todayCount = new Map<string, number>();
  for (const p of todayPlayers) todayCount.set(p.userId as string, (todayCount.get(p.userId as string) ?? 0) + 1);

  const players: (MMPlayer & { isAbsent?: boolean; photoUrl?: string | null })[] = eligibleMembers.map((m) => {
    const isAbsent = !checkedInUserIds.has(m.userId as string);
    const rec = checkedInRecords.find((r) => r.userId === m.userId);
    return {
      id: m.userId as string,
      name: (m.user as any).name,
      rating: ratingMap.get(m.userId as string) ?? 1000,
      matchesToday: todayCount.get(m.userId as string) ?? 0,
      checkedInAt: rec ? (rec.createdAt as Date).getTime() : Date.now() + 60000,
      isAbsent,
      photoUrl: (m.user as any).photoUrl
    };
  });

  const courtList = await courts().find({ clubId, deletedAt: null }).toArray();
  const now = new Date();
  const busyCourtIds = new Set<string>();
  const liveMatches = await matches().find({ clubId, status: "IN_PROGRESS", courtId: { $ne: null } }).toArray();
  liveMatches.forEach((m) => m.courtId && busyCourtIds.add(m.courtId as string));
  const activeBookings = await courtBookings().find({
    clubId, status: "CONFIRMED", startTime: { $lte: now }, endTime: { $gt: now }
  }).toArray();
  activeBookings.forEach((b) => busyCourtIds.add(b.courtId as string));
  const freeCourts = courtList.filter((c) => c.status === "AVAILABLE" && !busyCourtIds.has(c.id as string));

  return {
    players,
    freeCourts,
    allowAbsent,
    absentMembers: absentMembers.map((m) => ({
      id: m.userId as string,
      name: (m.user as any).name,
      rating: ratingMap.get(m.userId as string) ?? 1000,
      photoUrl: (m.user as any).photoUrl
    }))
  };
}

async function recentHistories(clubId: string): Promise<{ partners: Record<string, number>; opponents: Record<string, number> }> {
  const since = new Date(Date.now() - 30 * 86400000);
  const recentMatches = await matches().find({
    clubId, status: "COMPLETED", endedAt: { $gte: since }, type: "DOUBLES"
  }).limit(200).toArray();
  const matchIds = recentMatches.map((m) => m.id as string);
  const allTeams = await matchTeams().find({ matchId: { $in: matchIds } }).toArray();
  const allPlayers = await matchPlayers().find({ matchId: { $in: matchIds } }).toArray();

  const key = (a: string, b: string) => [a, b].sort().join("|");
  const partners: Record<string, number> = {};
  const opponents: Record<string, number> = {};
  for (const m of recentMatches) {
    const mTeams = allTeams.filter((t) => t.matchId === m.id);
    const teamA = mTeams.find((t) => t.teamIndex === 0);
    const teamB = mTeams.find((t) => t.teamIndex === 1);
    if (!teamA || !teamB) continue;
    const playersA = allPlayers.filter((p) => p.teamId === teamA.id);
    const playersB = allPlayers.filter((p) => p.teamId === teamB.id);
    for (const team of [playersA, playersB]) {
      if (team.length === 2) {
        const k = key(team[0].userId as string, team[1].userId as string);
        partners[k] = (partners[k] ?? 0) + 1;
      }
    }
    for (const a of playersA)
      for (const b of playersB) {
        const k = key(a.userId as string, b.userId as string);
        opponents[k] = (opponents[k] ?? 0) + 1;
      }
  }
  return { partners, opponents };
}

export async function preview(clubId: string, mode: "SINGLES" | "DOUBLES", options?: MatchmakingOptions) {
  const { players, freeCourts } = await buildAvailability(clubId, options);
  const histories = mode === "DOUBLES" ? await recentHistories(clubId) : { partners: {}, opponents: {} };
  return generateSchedule({
    players,
    courtsAvailable: freeCourts.length,
    mode,
    partnerHistory: histories.partners,
    opponentHistory: histories.opponents
  });
}

export async function previewWithMeta(clubId: string, mode: "SINGLES" | "DOUBLES", options?: MatchmakingOptions) {
  const [{ players, freeCourts, allowAbsent, absentMembers }, result] = await Promise.all([
    buildAvailability(clubId, options),
    preview(clubId, mode, options)
  ]);
  const playerById = new Map(players.map((p) => [p.id, p]));
  const assignments = result.assignments.map((a) => {
    const court = freeCourts[a.courtIndex];
    return {
      court: court ? { id: court.id, name: court.name, number: court.number } : null,
      teamA: a.teamA.map((p) => ({
        id: p.id, name: p.name, rating: Math.round(p.rating),
        isAbsent: playerById.get(p.id)?.isAbsent ?? false
      })),
      teamB: a.teamB.map((p) => ({
        id: p.id, name: p.name, rating: Math.round(p.rating),
        isAbsent: playerById.get(p.id)?.isAbsent ?? false
      })),
      explanation: a.explanation
    };
  });
  return {
    assignments,
    queue: result.queue.map((q) => {
      const p = playerById.get(q.id);
      return { id: q.id, name: p?.name ?? q.id, isAbsent: p?.isAbsent ?? false };
    }),
    summary: result.summary,
    availablePlayers: players.length,
    availableCourts: freeCourts.length,
    allowAbsent,
    absentPlayers: absentMembers,
    includedAbsentCount: players.filter((p) => p.isAbsent).length
  };
}

export async function applySchedule(
  clubId: string,
  actor: { id: string },
  mode: "SINGLES" | "DOUBLES",
  options?: MatchmakingOptions
) {
  const meta = await previewWithMeta(clubId, mode, options);
  if (meta.assignments.length === 0) throw ApiError.conflict(meta.summary.reasonIfEmpty ?? "Nothing to schedule");
  const { createMatch } = await import("./matches");
  const created = [];
  for (const a of meta.assignments) {
    const match = await createMatch(clubId, actor, {
      type: mode,
      teamAUserIds: a.teamA.map((p) => p.id),
      teamBUserIds: a.teamB.map((p) => p.id),
      courtId: (a.court?.id as string) ?? null,
      scheduledAt: new Date(),
      notes: `AI matchmaking (balance ${a.explanation.balancePct}%)${meta.includedAbsentCount ? " [includes absent players]" : ""}`,
      notify: false
    });
    created.push(match);
  }
  return { created, preview: meta };
}

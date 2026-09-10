import { prisma } from "@/server/db";
import { ApiError } from "@/lib/api";
import { generateSchedule, type MMPlayer } from "@/lib/engines/matchmaking";
import { dayKey } from "@/lib/date";
import { parseClubSettings } from "@/lib/constants";

export interface MatchmakingOptions {
  includeAbsent?: boolean;
  extraPlayerIds?: string[];
}

export async function buildAvailability(clubId: string, options?: MatchmakingOptions) {
  const club = await prisma.club.findFirst({ where: { id: clubId, deletedAt: null } });
  if (!club) throw ApiError.notFound("Club not found");
  const settings = parseClubSettings(club.settings);
  const allowAbsent = settings.matchmaking?.allowAbsent ?? false;

  const today = dayKey();
  const checkedInRecords = await prisma.attendanceRecord.findMany({
    where: { clubId, day: today, status: { in: ["PRESENT", "LATE"] } },
    orderBy: { createdAt: "asc" }
  });
  const checkedInUserIds = new Set(checkedInRecords.map((r) => r.userId));

  // Get all active members of the club
  const allActiveMembers = await prisma.clubMember.findMany({
    where: { clubId, status: "ACTIVE" },
    include: { user: { select: { id: true, name: true, photoUrl: true } } }
  });

  const absentMembers = allActiveMembers.filter((m) => !checkedInUserIds.has(m.userId));

  // Check permission / setting if absent players are requested
  const requestingAbsent = options?.includeAbsent || (options?.extraPlayerIds && options.extraPlayerIds.length > 0);
  if (requestingAbsent && !allowAbsent) {
    throw ApiError.forbidden("Adding absent players to matchmaking is not allowed by club settings");
  }

  const includeAllAbsent = allowAbsent && Boolean(options?.includeAbsent);
  const extraSet = allowAbsent && options?.extraPlayerIds?.length
    ? new Set(options.extraPlayerIds)
    : new Set<string>();

  const eligibleMembers = allActiveMembers.filter((m) => {
    if (checkedInUserIds.has(m.userId)) return true;
    if (includeAllAbsent) return true;
    if (extraSet.has(m.userId)) return true;
    return false;
  });

  const ratings = await prisma.playerRating.findMany({
    where: { clubId, userId: { in: allActiveMembers.map((m) => m.userId) } }
  });
  const ratingMap = new Map(ratings.map((r) => [r.userId, r.rating]));

  const matchesToday = await prisma.match.findMany({
    where: {
      clubId,
      status: { in: ["IN_PROGRESS", "COMPLETED"] },
      createdAt: { gte: new Date(`${today}T00:00:00`) }
    },
    select: { players: { select: { userId: true } } }
  });
  const todayCount = new Map<string, number>();
  for (const m of matchesToday) {
    for (const p of m.players) todayCount.set(p.userId, (todayCount.get(p.userId) ?? 0) + 1);
  }

  const players: (MMPlayer & { isAbsent?: boolean; photoUrl?: string | null })[] = eligibleMembers.map((m) => {
    const isAbsent = !checkedInUserIds.has(m.userId);
    const rec = checkedInRecords.find((r) => r.userId === m.userId);
    return {
      id: m.userId,
      name: m.user.name,
      rating: ratingMap.get(m.userId) ?? 1000,
      matchesToday: todayCount.get(m.userId) ?? 0,
      checkedInAt: rec ? rec.createdAt.getTime() : Date.now() + 60000,
      isAbsent,
      photoUrl: m.user.photoUrl
    };
  });

  const courts = await prisma.court.findMany({ where: { clubId, deletedAt: null } });
  const now = new Date();
  const busyCourtIds = new Set<string>();
  const liveMatches = await prisma.match.findMany({ where: { clubId, status: "IN_PROGRESS", courtId: { not: null } } });
  liveMatches.forEach((m) => m.courtId && busyCourtIds.add(m.courtId));
  const activeBookings = await prisma.courtBooking.findMany({
    where: { clubId, status: "CONFIRMED", startTime: { lte: now }, endTime: { gt: now } }
  });
  activeBookings.forEach((b) => busyCourtIds.add(b.courtId));
  const freeCourts = courts.filter((c) => c.status === "AVAILABLE" && !busyCourtIds.has(c.id));

  return {
    players,
    freeCourts,
    allowAbsent,
    absentMembers: absentMembers.map((m) => ({
      id: m.userId,
      name: m.user.name,
      rating: ratingMap.get(m.userId) ?? 1000,
      photoUrl: m.user.photoUrl
    }))
  };
}

async function recentHistories(clubId: string): Promise<{ partners: Record<string, number>; opponents: Record<string, number> }> {
  const since = new Date(Date.now() - 30 * 86400000);
  const matches = await prisma.match.findMany({
    where: { clubId, status: "COMPLETED", endedAt: { gte: since }, type: "DOUBLES" },
    include: { teams: { include: { players: true } } },
    take: 200
  });
  const key = (a: string, b: string) => [a, b].sort().join("|");
  const partners: Record<string, number> = {};
  const opponents: Record<string, number> = {};
  for (const m of matches) {
    const teamA = m.teams.find((t) => t.teamIndex === 0);
    const teamB = m.teams.find((t) => t.teamIndex === 1);
    if (!teamA || !teamB) continue;
    for (const team of [teamA, teamB]) {
      if (team.players.length === 2) {
        const k = key(team.players[0].userId, team.players[1].userId);
        partners[k] = (partners[k] ?? 0) + 1;
      }
    }
    for (const a of teamA.players)
      for (const b of teamB.players) {
        const k = key(a.userId, b.userId);
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
        id: p.id,
        name: p.name,
        rating: Math.round(p.rating),
        isAbsent: playerById.get(p.id)?.isAbsent ?? false
      })),
      teamB: a.teamB.map((p) => ({
        id: p.id,
        name: p.name,
        rating: Math.round(p.rating),
        isAbsent: playerById.get(p.id)?.isAbsent ?? false
      })),
      explanation: a.explanation
    };
  });
  return {
    assignments,
    queue: result.queue.map((q) => {
      const p = playerById.get(q.id);
      return {
        id: q.id,
        name: p?.name ?? q.id,
        isAbsent: p?.isAbsent ?? false
      };
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
      courtId: a.court?.id ?? null,
      scheduledAt: new Date(),
      notes: `AI matchmaking (balance ${a.explanation.balancePct}%)${meta.includedAbsentCount ? " [includes absent players]" : ""}`,
      notify: false
    });
    created.push(match);
  }
  return { created, preview: meta };
}


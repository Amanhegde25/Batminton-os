import { prisma } from "@/server/db";
import { ApiError } from "@/lib/api";
import { generateSchedule, type MMPlayer } from "@/lib/engines/matchmaking";
import { dayKey } from "@/lib/date";

export async function buildAvailability(clubId: string) {
  const today = dayKey();
  const records = await prisma.attendanceRecord.findMany({
    where: { clubId, day: today, status: { in: ["PRESENT", "LATE"] } },
    orderBy: { createdAt: "asc" }
  });
  const members = await prisma.clubMember.findMany({
    where: { clubId, status: "ACTIVE", userId: { in: records.map((r) => r.userId) } },
    include: { user: { select: { id: true, name: true, photoUrl: true } } }
  });

  const ratings = await prisma.playerRating.findMany({ where: { clubId, userId: { in: members.map((m) => m.userId) } } });
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

  const players: MMPlayer[] = members.map((m) => ({
    id: m.userId,
    name: m.user.name,
    rating: ratingMap.get(m.userId) ?? 1000,
    matchesToday: todayCount.get(m.userId) ?? 0,
    checkedInAt: (records.find((r) => r.userId === m.userId)?.createdAt.getTime()) ?? Date.now()
  }));

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

  return { players, freeCourts };
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

export async function preview(clubId: string, mode: "SINGLES" | "DOUBLES") {
  const { players, freeCourts } = await buildAvailability(clubId);
  const histories = mode === "DOUBLES" ? await recentHistories(clubId) : { partners: {}, opponents: {} };
  return generateSchedule({
    players,
    courtsAvailable: freeCourts.length,
    mode,
    partnerHistory: histories.partners,
    opponentHistory: histories.opponents
  });
}

export async function previewWithMeta(clubId: string, mode: "SINGLES" | "DOUBLES") {
  const [{ players, freeCourts }, result] = await Promise.all([buildAvailability(clubId), preview(clubId, mode)]);
  const nameById = new Map(players.map((p) => [p.id, p]));
  const assignments = result.assignments.map((a) => {
    const court = freeCourts[a.courtIndex];
    return {
      court: court ? { id: court.id, name: court.name, number: court.number } : null,
      teamA: a.teamA.map((p) => ({ id: p.id, name: p.name, rating: Math.round(p.rating) })),
      teamB: a.teamB.map((p) => ({ id: p.id, name: p.name, rating: Math.round(p.rating) })),
      explanation: a.explanation
    };
  });
  return {
    assignments,
    queue: result.queue.map((q) => nameById.get(q.id)?.name ?? q.id),
    summary: result.summary,
    availablePlayers: players.length,
    availableCourts: freeCourts.length
  };
}

export async function applySchedule(
  clubId: string,
  actor: { id: string },
  mode: "SINGLES" | "DOUBLES"
) {
  const meta = await previewWithMeta(clubId, mode);
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
      notes: `AI matchmaking (balance ${a.explanation.balancePct}%)`,
      notify: false
    });
    created.push(match);
  }
  return { created, preview: meta };
}

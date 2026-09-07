import { prisma, type Tx } from "@/server/db";
import { ApiError } from "@/lib/api";
import { AUDIT_ACTIONS } from "@/lib/constants";
import { dayKey, startOfDay, endOfDay } from "@/lib/date";
import { validateMatchSets, totalPoints, type SetScore } from "@/lib/engines/scoring";
import { audit } from "./audit";
import { notify } from "./notifications";
import { issueFromEvent } from "./penalties";
import { applyMatchResultToRatings } from "./rating";

const matchInclude = {
  teams: { include: { players: { include: { user: { select: { id: true, name: true, photoUrl: true } } } } } },
  scores: true,
  court: { select: { id: true, name: true, number: true } }
} as const;

type MatchWithRelations = PrismaMatch;

interface PrismaMatch {
  id: string;
  clubId: string;
  type: string;
  status: string;
  courtId: string | null;
  scheduledAt: Date | null;
  startedAt: Date | null;
  endedAt: Date | null;
  winnerTeamIndex: number | null;
  isWalkover: boolean;
  notes: string | null;
  tournamentId: string | null;
  roundLabel: string | null;
  teams: {
    id: string;
    teamIndex: number;
    name: string | null;
    players: { userId: string; user: { id: string; name: string; photoUrl: string | null } }[];
  }[];
  scores: { setNumber: number; scoreA: number; scoreB: number }[];
  court: { id: string; name: string; number: number } | null;
}

export async function createMatch(
  clubId: string,
  actor: { id: string },
  input: {
    type: "SINGLES" | "DOUBLES";
    teamAUserIds: string[];
    teamBUserIds: string[];
    courtId?: string | null;
    scheduledAt?: Date | null;
    notes?: string | null;
    tournamentId?: string | null;
    notify?: boolean;
  }
) {
  const expected = input.type === "SINGLES" ? 1 : 2;
  if (input.teamAUserIds.length !== expected || input.teamBUserIds.length !== expected) {
    throw ApiError.badRequest(`${input.type} requires ${expected} player(s) per team`);
  }
  const allIds = [...input.teamAUserIds, ...input.teamBUserIds];
  if (new Set(allIds).size !== allIds.length) throw ApiError.badRequest("Players must be unique across teams");
  const memberships = await prisma.clubMember.findMany({
    where: { clubId, userId: { in: allIds }, status: "ACTIVE" }
  });
  const memberIds = new Set(memberships.map((m) => m.userId));
  for (const id of allIds) {
    if (!memberIds.has(id)) throw ApiError.badRequest("All players must be active members of this club");
  }
  let courtId: string | null = null;
  if (input.courtId) {
    const court = await prisma.court.findFirst({ where: { id: input.courtId, clubId, deletedAt: null } });
    if (!court) throw ApiError.notFound("Court not found");
    if (court.status !== "AVAILABLE") throw ApiError.conflict(`Court is ${court.status.toLowerCase()}`);
    courtId = court.id;
  }

  const match = await prisma.match.create({
    data: {
      clubId,
      type: input.type,
      status: "SCHEDULED",
      courtId,
      scheduledAt: input.scheduledAt ?? new Date(),
      notes: input.notes ?? null,
      tournamentId: input.tournamentId ?? null,
      createdById: actor.id
    }
  });
  await prisma.matchTeam.createMany({
    data: [
      { matchId: match.id, teamIndex: 0, name: "Team A" },
      { matchId: match.id, teamIndex: 1, name: "Team B" }
    ]
  });
  const teams = await prisma.matchTeam.findMany({ where: { matchId: match.id } });
  const tA = teams.find((t) => t.teamIndex === 0)!;
  const tB = teams.find((t) => t.teamIndex === 1)!;
  await prisma.matchPlayer.createMany({
    data: [
      ...input.teamAUserIds.map((userId) => ({ matchId: match.id, teamId: tA.id, userId })),
      ...input.teamBUserIds.map((userId) => ({ matchId: match.id, teamId: tB.id, userId }))
    ]
  });
  const full = await loadMatch(clubId, match.id);

  if (input.notify !== false) {
    await notifySafe(
      allIds.map((userId) => ({
        userId,
        clubId,
        type: "MATCH_CREATED",
        title: "New match assigned",
        body: `${input.type.toLowerCase()} match${courtId ? " on a court" : ""} — check Matches.`,
        data: { matchId: match.id }
      }))
    );
  }
  return serializeMatch(full as unknown as MatchWithRelations);
}

async function notifySafe(inputs: Parameters<typeof notify>[0][]) {
  try {
    for (const i of inputs) await notify(i);
  } catch {}
}

export async function startMatch(clubId: string, matchId: string) {
  const match = await loadMatch(clubId, matchId);
  if (match.status !== "SCHEDULED") throw ApiError.conflict(`Cannot start a ${match.status.toLowerCase()} match`);
  const updated = await prisma.match.update({
    where: { id: matchId },
    data: { status: "IN_PROGRESS", startedAt: new Date() },
    include: matchInclude
  });
  return serializeMatch(updated as unknown as MatchWithRelations);
}

export async function enterScores(clubId: string, matchId: string, sets: SetScore[]) {
  const match = await loadMatch(clubId, matchId);
  if (!["SCHEDULED", "IN_PROGRESS"].includes(match.status)) {
    throw ApiError.conflict("Scores can only be entered before completion");
  }
  if (sets.length > 3) throw ApiError.badRequest("Max 3 sets");
  await prisma.matchScore.deleteMany({ where: { matchId } });
  if (sets.length > 0) {
    await prisma.matchScore.createMany({
      data: sets.map((s, idx) => ({ matchId, setNumber: idx + 1, scoreA: s.a, scoreB: s.b }))
    });
  }
  return serializeMatch(await loadMatch(clubId, matchId));
}

export async function completeMatch(
  clubId: string,
  matchId: string,
  actor: { id: string },
  opts: { sets?: SetScore[]; walkoverWinnerTeamIndex?: number; notify?: boolean } = {}
) {
  const match = (await loadMatch(clubId, matchId)) as unknown as MatchWithRelations;
  if (!["SCHEDULED", "IN_PROGRESS"].includes(match.status)) {
    throw ApiError.conflict(`Match is already ${match.status.toLowerCase()}`);
  }
  const playersA = teamPlayerIds(match, 0);
  const playersB = teamPlayerIds(match, 1);

  let winnerIdx: number;
  let walkover = false;
  let setsWonA = 0;
  let setsWonB = 0;
  let pointsA = 0;
  let pointsB = 0;
  let finalSets: SetScore[] = [];

  if (opts.walkoverWinnerTeamIndex !== undefined) {
    if (![0, 1].includes(opts.walkoverWinnerTeamIndex)) throw ApiError.badRequest("winnerTeamIndex must be 0 or 1");
    winnerIdx = opts.walkoverWinnerTeamIndex;
    walkover = true;
    setsWonA = winnerIdx === 0 ? 2 : 0;
    setsWonB = winnerIdx === 1 ? 2 : 0;
    pointsA = 21;
    pointsB = 10;
  } else {
    const sets = opts.sets ?? match.scores.map((s) => ({ a: s.scoreA, b: s.scoreB }));
    const validation = validateMatchSets(sets);
    if (!validation.ok || !validation.winnerTeam) {
      throw ApiError.badRequest(validation.error ?? "Invalid score");
    }
    winnerIdx = validation.winnerTeam === "A" ? 0 : 1;
    setsWonA = validation.setsWonA;
    setsWonB = validation.setsWonB;
    const totals = totalPoints(sets);
    pointsA = totals.forA;
    pointsB = totals.forB;
    finalSets = sets;
  }

  const result = await prisma.$transaction(
    async (tx) => {
    await tx.matchScore.deleteMany({ where: { matchId } });
    if (finalSets.length > 0) {
      await tx.matchScore.createMany({
        data: finalSets.map((s, idx) => ({ matchId, setNumber: idx + 1, scoreA: s.a, scoreB: s.b }))
      });
    }
    const loserIds = winnerIdx === 0 ? playersB : playersA;
    const eventType = walkover ? "WALKOVER" : "LOSS";
    for (const loser of loserIds) {
      await issueFromEvent(tx, clubId, loser, eventType as any, {
        relatedType: "Match",
        relatedId: matchId,
        reason: walkover ? "Walkover given" : undefined
      });
    }
    const ratings = await applyMatchResultToRatings(tx, {
      clubId,
      matchId,
      playersA,
      playersB,
      setsWonA,
      setsWonB,
      pointsA,
      pointsB,
      walkover
    });
    const updated = await tx.match.update({
      where: { id: matchId },
      data: {
        status: "COMPLETED",
        endedAt: new Date(),
        winnerTeamIndex: winnerIdx,
        isWalkover: walkover
      },
      include: matchInclude
    });
    return { match: updated, ratings };
    },
    { timeout: 30000, maxWait: 10000 }
  );

  if (match.courtId && match.status === "IN_PROGRESS") {
    await prisma.court.updateMany({ where: { id: match.courtId }, data: { status: "AVAILABLE" } }).catch(() => {});
  }

  if (opts.notify !== false) {
    const summary =
      walkover
        ? `Result by walkover`
        : `${finalSets.map((s) => `${s.a}-${s.b}`).join(", ")}`;
    await notifySafe([
      ...playersA.map((userId) => ({
        userId,
        clubId,
        type: "MATCH_RESULT",
        title: winnerIdx === 0 ? "You won!" : "Match lost",
        body: summary,
        data: { matchId }
      })),
      ...playersB.map((userId) => ({
        userId,
        clubId,
        type: "MATCH_RESULT",
        title: winnerIdx === 1 ? "You won!" : "Match lost",
        body: summary,
        data: { matchId }
      }))
    ]);
  }
  void actor;
  return { ...serializeMatch(result.match as unknown as MatchWithRelations), ratingChanges: result.ratings };
}

export async function cancelMatch(clubId: string, matchId: string, actor: { id: string }) {
  const match = await loadMatch(clubId, matchId);
  if (["COMPLETED", "CANCELLED"].includes(match.status)) throw ApiError.conflict(`Match is already ${match.status.toLowerCase()}`);
  const updated = await prisma.match.update({
    where: { id: matchId },
    data: { status: "CANCELLED", endedAt: new Date(), deletedAt: null },
    include: matchInclude
  });
  await audit({
    clubId,
    actorUserId: actor.id,
    action: AUDIT_ACTIONS.MATCH_CANCELLED,
    entityType: "Match",
    entityId: matchId
  });
  return serializeMatch(updated as unknown as MatchWithRelations);
}

export async function editMatch(
  clubId: string,
  matchId: string,
  actor: { id: string },
  patch: { teamAUserIds?: string[]; teamBUserIds?: string[]; courtId?: string | null; scheduledAt?: Date | null; notes?: string | null }
) {
  const match = await loadMatch(clubId, matchId);
  if (["COMPLETED", "WALKOVER", "CANCELLED"].includes(match.status)) {
    throw ApiError.conflict("Completed matches cannot be edited");
  }
  if (patch.teamAUserIds || patch.teamBUserIds) {
    const type = match.type as "SINGLES" | "DOUBLES";
    const expected = type === "SINGLES" ? 1 : 2;
    const teamA = patch.teamAUserIds ?? teamPlayerIds(match, 0);
    const teamB = patch.teamBUserIds ?? teamPlayerIds(match, 1);
    if (teamA.length !== expected || teamB.length !== expected) {
      throw ApiError.badRequest(`${type} requires ${expected} player(s) per team`);
    }
    const all = [...teamA, ...teamB];
    if (new Set(all).size !== all.length) throw ApiError.badRequest("Duplicate players across teams");
    const memberships = await prisma.clubMember.count({
      where: { clubId, userId: { in: all }, status: "ACTIVE" }
    });
    if (memberships !== all.length) throw ApiError.badRequest("All players must be active members");
    await prisma.$transaction(async (tx) => {
      await tx.matchPlayer.deleteMany({ where: { matchId } });
      await tx.matchTeam.deleteMany({ where: { matchId } });
      await tx.matchTeam.createMany({
        data: [
          { matchId, teamIndex: 0, name: "Team A" },
          { matchId, teamIndex: 1, name: "Team B" }
        ]
      });
      const teams = await tx.matchTeam.findMany({ where: { matchId } });
      const tA = teams.find((t) => t.teamIndex === 0)!;
      const tB = teams.find((t) => t.teamIndex === 1)!;
      await tx.matchPlayer.createMany({
        data: [...teamA.map((userId) => ({ matchId, teamId: tA.id, userId })), ...teamB.map((userId) => ({ matchId, teamId: tB.id, userId }))]
      });
    }, { timeout: 20000, maxWait: 10000 });
  }
  const updated = await prisma.match.update({
    where: { id: matchId },
    data: {
      ...(patch.courtId !== undefined ? { courtId: patch.courtId } : {}),
      ...(patch.scheduledAt !== undefined ? { scheduledAt: patch.scheduledAt } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes } : {})
    },
    include: matchInclude
  });
  await audit({
    clubId,
    actorUserId: actor.id,
    action: AUDIT_ACTIONS.MATCH_EDITED,
    entityType: "Match",
    entityId: matchId,
    newValue: patch as Record<string, unknown>
  });
  return serializeMatch(updated as unknown as MatchWithRelations);
}

export async function listMatches(
  clubId: string,
  opts: { status?: string[]; userId?: string; page?: number; pageSize?: number; day?: string; tournamentId?: string }
) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(50, Math.max(5, opts.pageSize ?? 20));
  let dayRange: { gte: Date; lt: Date } | null = null;
  if (opts.day) {
    const raw =
      /^\d{4}-\d{2}-\d{2}$/.test(opts.day)
        ? new Date(`${opts.day}T00:00:00`)
        : new Date();
    if (!Number.isNaN(raw.getTime())) {
      const gte = startOfDay(raw);
      dayRange = { gte, lt: endOfDay(gte) };
    }
  }
  const where = {
    clubId,
    deletedAt: null,
    ...(opts.status?.length ? { status: { in: opts.status } } : {}),
    ...(opts.tournamentId ? { tournamentId: opts.tournamentId } : {}),
    ...(dayRange ? { scheduledAt: { gte: dayRange.gte, lt: dayRange.lt } } : {}),
    ...(opts.userId ? { players: { some: { userId: opts.userId } } } : {})
  };
  const [items, total] = await Promise.all([
    prisma.match.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: matchInclude
    }),
    prisma.match.count({ where })
  ]);
  return { items: items.map((m) => serializeMatch(m as unknown as MatchWithRelations)), total, page, pageSize };
}

export async function getMatch(clubId: string, matchId: string) {
  const match = await loadMatch(clubId, matchId);
  const serialized = serializeMatch(match as unknown as MatchWithRelations);
  const deltas = await prisma.ratingHistory.findMany({ where: { matchId }, include: { user: { select: { name: true } } } });
  return {
    ...serialized,
    ratingChanges:
      serialized.status === "COMPLETED"
        ? Object.fromEntries(deltas.map((d) => [d.userId, Math.round(d.delta)]))
        : null
  };
}

export async function todayForPlayer(clubId: string, userId: string) {
  const from = startOfDay();
  const to = endOfDay();
  const matches = await prisma.match.findMany({
    where: {
      clubId,
      players: { some: { userId } },
      OR: [{ createdAt: { gte: from, lt: to } }, { startedAt: { gte: from, lt: to } }]
    },
    include: matchInclude,
    orderBy: { createdAt: "desc" },
    take: 10
  });
  return matches.map((m) => serializeMatch(m as unknown as MatchWithRelations));
}

export async function recentForClub(clubId: string, take = 8) {
  const items = await prisma.match.findMany({
    where: { clubId, status: "COMPLETED" },
    include: matchInclude,
    orderBy: { endedAt: "desc" },
    take
  });
  return items.map((m) => serializeMatch(m as unknown as MatchWithRelations));
}

export async function liveForClub(clubId: string) {
  const items = await prisma.match.findMany({
    where: { clubId, status: "IN_PROGRESS" },
    include: matchInclude
  });
  return items.map((m) => serializeMatch(m as unknown as MatchWithRelations));
}

function teamPlayerIds(match: MatchWithRelations, idx: number): string[] {
  const team = match.teams.find((t) => t.teamIndex === idx);
  return team ? team.players.map((p) => p.userId) : [];
}

async function loadMatch(clubId: string, matchId: string): Promise<PrismaMatch> {
  const match = await prisma.match.findFirst({
    where: { id: matchId, clubId, deletedAt: null },
    include: matchInclude
  });
  if (!match) throw ApiError.notFound("Match not found");
  return match as unknown as PrismaMatch;
}

export function serializeMatch(m: MatchWithRelations) {
  return {
    id: m.id,
    clubId: m.clubId,
    type: m.type,
    status: m.status,
    court: m.court,
    scheduledAt: m.scheduledAt,
    startedAt: m.startedAt,
    endedAt: m.endedAt,
    winnerTeamIndex: m.winnerTeamIndex,
    isWalkover: m.isWalkover,
    notes: m.notes,
    tournamentId: m.tournamentId,
    roundLabel: m.roundLabel,
    teams: [0, 1].map((idx) => {
      const team = m.teams.find((t) => t.teamIndex === idx);
      return {
        teamIndex: idx,
        players: team?.players.map((p) => p.user) ?? []
      };
    }),
    scores: [...m.scores]
      .sort((a, b) => a.setNumber - b.setNumber)
      .map((s) => ({ setNumber: s.setNumber, a: s.scoreA, b: s.scoreB }))
  };
}

export function todayKey(): string {
  return dayKey();
}

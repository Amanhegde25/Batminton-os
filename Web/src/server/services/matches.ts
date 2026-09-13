import { clubMembers, courts, matches, matchTeams, matchPlayers, matchScores, ratingHistories } from "@/server/db";
import { ApiError } from "@/lib/api";
import { AUDIT_ACTIONS } from "@/lib/constants";
import { dayKey, startOfDay, endOfDay } from "@/lib/date";
import { validateMatchSets, totalPoints, type SetScore } from "@/lib/engines/scoring";
import { audit } from "./audit";
import { notify } from "./notifications";
import { issueFromEvent } from "./penalties";
import { applyMatchResultToRatings } from "./rating";
import { cuid } from "@/lib/id";

interface MatchWithRelations {
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

async function loadMatchWithRelations(clubId: string, matchId: string): Promise<MatchWithRelations> {
  const match = await matches().findOne({ id: matchId, clubId, deletedAt: null });
  if (!match) throw ApiError.notFound("Match not found");

  const teams = await matchTeams().find({ matchId }).toArray();
  const players = await matchPlayers().find({ matchId }).toArray();
  const scores = await matchScores().find({ matchId }).toArray();

  const playerUserIds = players.map((p) => p.userId as string);
  const { users } = await import("@/server/db");
  const usersData = await users().find(
    { id: { $in: playerUserIds } },
    { projection: { id: 1, name: 1, photoUrl: 1, _id: 0 } }
  ).toArray();
  const userMap = new Map(usersData.map((u) => [u.id as string, u]));

  let court: { id: string; name: string; number: number } | null = null;
  if (match.courtId) {
    const c = await courts().findOne(
      { id: match.courtId as string },
      { projection: { id: 1, name: 1, number: 1, _id: 0 } }
    );
    if (c) court = { id: c.id as string, name: c.name as string, number: c.number as number };
  }

  return {
    id: match.id as string,
    clubId: match.clubId as string,
    type: match.type as string,
    status: match.status as string,
    courtId: (match.courtId as string) ?? null,
    scheduledAt: (match.scheduledAt as Date) ?? null,
    startedAt: (match.startedAt as Date) ?? null,
    endedAt: (match.endedAt as Date) ?? null,
    winnerTeamIndex: (match.winnerTeamIndex as number) ?? null,
    isWalkover: (match.isWalkover as boolean) ?? false,
    notes: (match.notes as string) ?? null,
    tournamentId: (match.tournamentId as string) ?? null,
    roundLabel: (match.roundLabel as string) ?? null,
    teams: teams.map((t) => ({
      id: t.id as string,
      teamIndex: t.teamIndex as number,
      name: (t.name as string) ?? null,
      players: players
        .filter((p) => p.teamId === t.id)
        .map((p) => ({
          userId: p.userId as string,
          user: (userMap.get(p.userId as string) as any) ?? { id: p.userId, name: "Unknown", photoUrl: null }
        }))
    })),
    scores: scores.map((s) => ({
      setNumber: s.setNumber as number,
      scoreA: s.scoreA as number,
      scoreB: s.scoreB as number
    })),
    court
  };
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
  const memberships = await clubMembers().find({ clubId, userId: { $in: allIds }, status: "ACTIVE" }).toArray();
  const memberIds = new Set(memberships.map((m) => m.userId as string));
  for (const id of allIds) {
    if (!memberIds.has(id)) throw ApiError.badRequest("All players must be active members of this club");
  }
  let courtId: string | null = null;
  if (input.courtId) {
    const court = await courts().findOne({ id: input.courtId, clubId, deletedAt: null });
    if (!court) throw ApiError.notFound("Court not found");
    if (court.status !== "AVAILABLE") throw ApiError.conflict(`Court is ${(court.status as string).toLowerCase()}`);
    courtId = court.id as string;
  }

  const matchId = cuid();
  const now = new Date();
  await matches().insertOne({
    id: matchId,
    clubId,
    type: input.type,
    format: "BEST_OF_3",
    status: "SCHEDULED",
    courtId,
    scheduledAt: input.scheduledAt ?? now,
    startedAt: null,
    endedAt: null,
    winnerTeamIndex: null,
    isWalkover: false,
    notes: input.notes ?? null,
    tournamentId: input.tournamentId ?? null,
    roundLabel: null,
    createdById: actor.id,
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  });

  const teamAId = cuid();
  const teamBId = cuid();
  await matchTeams().insertMany([
    { id: teamAId, matchId, teamIndex: 0, name: "Team A" },
    { id: teamBId, matchId, teamIndex: 1, name: "Team B" }
  ]);
  await matchPlayers().insertMany([
    ...input.teamAUserIds.map((userId) => ({ id: cuid(), matchId, teamId: teamAId, userId })),
    ...input.teamBUserIds.map((userId) => ({ id: cuid(), matchId, teamId: teamBId, userId }))
  ]);

  const full = await loadMatchWithRelations(clubId, matchId);

  if (input.notify !== false) {
    await notifySafe(
      allIds.map((userId) => ({
        userId,
        clubId,
        type: "MATCH_CREATED",
        title: "New match assigned",
        body: `${input.type.toLowerCase()} match${courtId ? " on a court" : ""} — check Matches.`,
        data: { matchId }
      }))
    );
  }
  return serializeMatch(full);
}

async function notifySafe(inputs: Parameters<typeof notify>[0][]) {
  try {
    for (const i of inputs) await notify(i);
  } catch {}
}

export async function startMatch(clubId: string, matchId: string) {
  const match = await loadMatchWithRelations(clubId, matchId);
  if (match.status !== "SCHEDULED") throw ApiError.conflict(`Cannot start a ${match.status.toLowerCase()} match`);
  await matches().updateOne(
    { id: matchId },
    { $set: { status: "IN_PROGRESS", startedAt: new Date(), updatedAt: new Date() } }
  );
  const updated = await loadMatchWithRelations(clubId, matchId);
  return serializeMatch(updated);
}

export async function enterScores(clubId: string, matchId: string, sets: SetScore[]) {
  const match = await loadMatchWithRelations(clubId, matchId);
  if (!["SCHEDULED", "IN_PROGRESS"].includes(match.status)) {
    throw ApiError.conflict("Scores can only be entered before completion");
  }
  if (sets.length > 3) throw ApiError.badRequest("Max 3 sets");
  await matchScores().deleteMany({ matchId });
  if (sets.length > 0) {
    await matchScores().insertMany(
      sets.map((s, idx) => ({ id: cuid(), matchId, setNumber: idx + 1, scoreA: s.a, scoreB: s.b }))
    );
  }
  return serializeMatch(await loadMatchWithRelations(clubId, matchId));
}

export async function completeMatch(
  clubId: string,
  matchId: string,
  actor: { id: string },
  opts: { sets?: SetScore[]; walkoverWinnerTeamIndex?: number; notify?: boolean } = {}
) {
  const match = await loadMatchWithRelations(clubId, matchId);
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

  // Save scores
  await matchScores().deleteMany({ matchId });
  if (finalSets.length > 0) {
    await matchScores().insertMany(
      finalSets.map((s, idx) => ({ id: cuid(), matchId, setNumber: idx + 1, scoreA: s.a, scoreB: s.b }))
    );
  }

  // Issue penalties for losers
  const loserIds = winnerIdx === 0 ? playersB : playersA;
  const eventType = walkover ? "WALKOVER" : "LOSS";
  for (const loser of loserIds) {
    await issueFromEvent(null, clubId, loser, eventType as any, {
      relatedType: "Match",
      relatedId: matchId,
      reason: walkover ? "Walkover given" : undefined
    });
  }

  // Apply rating changes
  const ratings = await applyMatchResultToRatings(null, {
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

  // Update match status
  await matches().updateOne(
    { id: matchId },
    { $set: { status: "COMPLETED", endedAt: new Date(), winnerTeamIndex: winnerIdx, isWalkover: walkover, updatedAt: new Date() } }
  );

  if (match.courtId && match.status === "IN_PROGRESS") {
    await courts().updateMany({ id: match.courtId }, { $set: { status: "AVAILABLE" } }).catch(() => {});
  }

  if (opts.notify !== false) {
    const summary = walkover
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

  const updated = await loadMatchWithRelations(clubId, matchId);
  return { ...serializeMatch(updated), ratingChanges: ratings };
}

export async function cancelMatch(clubId: string, matchId: string, actor: { id: string }) {
  const match = await loadMatchWithRelations(clubId, matchId);
  if (["COMPLETED", "CANCELLED"].includes(match.status)) throw ApiError.conflict(`Match is already ${match.status.toLowerCase()}`);
  await matches().updateOne(
    { id: matchId },
    { $set: { status: "CANCELLED", endedAt: new Date(), updatedAt: new Date() } }
  );
  await audit({
    clubId,
    actorUserId: actor.id,
    action: AUDIT_ACTIONS.MATCH_CANCELLED,
    entityType: "Match",
    entityId: matchId
  });
  const updated = await loadMatchWithRelations(clubId, matchId);
  return serializeMatch(updated);
}

export async function editMatch(
  clubId: string,
  matchId: string,
  actor: { id: string },
  patch: { teamAUserIds?: string[]; teamBUserIds?: string[]; courtId?: string | null; scheduledAt?: Date | null; notes?: string | null }
) {
  const match = await loadMatchWithRelations(clubId, matchId);
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
    const memberships = await clubMembers().countDocuments({ clubId, userId: { $in: all }, status: "ACTIVE" });
    if (memberships !== all.length) throw ApiError.badRequest("All players must be active members");

    await matchPlayers().deleteMany({ matchId });
    await matchTeams().deleteMany({ matchId });
    const teamAId = cuid();
    const teamBId = cuid();
    await matchTeams().insertMany([
      { id: teamAId, matchId, teamIndex: 0, name: "Team A" },
      { id: teamBId, matchId, teamIndex: 1, name: "Team B" }
    ]);
    await matchPlayers().insertMany([
      ...teamA.map((userId) => ({ id: cuid(), matchId, teamId: teamAId, userId })),
      ...teamB.map((userId) => ({ id: cuid(), matchId, teamId: teamBId, userId }))
    ]);
  }
  const data: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.courtId !== undefined) data.courtId = patch.courtId;
  if (patch.scheduledAt !== undefined) data.scheduledAt = patch.scheduledAt;
  if (patch.notes !== undefined) data.notes = patch.notes;
  await matches().updateOne({ id: matchId }, { $set: data });
  await audit({
    clubId,
    actorUserId: actor.id,
    action: AUDIT_ACTIONS.MATCH_EDITED,
    entityType: "Match",
    entityId: matchId,
    newValue: patch as Record<string, unknown>
  });
  const updated = await loadMatchWithRelations(clubId, matchId);
  return serializeMatch(updated);
}

export async function listMatches(
  clubId: string,
  opts: { status?: string[]; userId?: string; page?: number; pageSize?: number; day?: string; tournamentId?: string }
) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(50, Math.max(5, opts.pageSize ?? 20));
  const filter: Record<string, unknown> = { clubId, deletedAt: null };
  if (opts.status?.length) filter.status = { $in: opts.status };
  if (opts.tournamentId) filter.tournamentId = opts.tournamentId;

  if (opts.day) {
    const raw = /^\d{4}-\d{2}-\d{2}$/.test(opts.day) ? new Date(`${opts.day}T00:00:00`) : new Date();
    if (!Number.isNaN(raw.getTime())) {
      const gte = startOfDay(raw);
      filter.scheduledAt = { $gte: gte, $lt: endOfDay(gte) };
    }
  }

  if (opts.userId) {
    const playerMatches = await matchPlayers().find({ userId: opts.userId }, { projection: { matchId: 1 } }).toArray();
    filter.id = { $in: playerMatches.map((p) => p.matchId) };
  }

  const [rawMatches, total] = await Promise.all([
    matches().find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(),
    matches().countDocuments(filter)
  ]);
  const items = [];
  for (const m of rawMatches) {
    const full = await loadMatchWithRelations(clubId, m.id as string);
    items.push(serializeMatch(full));
  }
  return { items, total, page, pageSize };
}

export async function getMatch(clubId: string, matchId: string) {
  const match = await loadMatchWithRelations(clubId, matchId);
  const serialized = serializeMatch(match);
  const deltas = await ratingHistories().aggregate([
    { $match: { matchId } },
    {
      $lookup: {
        from: "users",
        let: { uid: "$userId" },
        pipeline: [
          { $match: { $expr: { $eq: ["$id", "$$uid"] } } },
          { $project: { name: 1, _id: 0 } }
        ],
        as: "user"
      }
    },
    { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } }
  ]).toArray();
  return {
    ...serialized,
    ratingChanges:
      serialized.status === "COMPLETED"
        ? Object.fromEntries(deltas.map((d) => [d.userId, Math.round(d.delta as number)]))
        : null
  };
}

export async function todayForPlayer(clubId: string, userId: string) {
  const from = startOfDay();
  const to = endOfDay();
  const playerMatches = await matchPlayers().find({ userId }, { projection: { matchId: 1 } }).toArray();
  const matchIds = playerMatches.map((p) => p.matchId as string);
  const todayMatches = await matches().find({
    clubId,
    id: { $in: matchIds },
    $or: [
      { createdAt: { $gte: from, $lt: to } },
      { startedAt: { $gte: from, $lt: to } }
    ]
  }).sort({ createdAt: -1 }).limit(10).toArray();
  const items = [];
  for (const m of todayMatches) {
    const full = await loadMatchWithRelations(clubId, m.id as string);
    items.push(serializeMatch(full));
  }
  return items;
}

export async function recentForClub(clubId: string, take = 8) {
  const recentMatches = await matches().find({ clubId, status: "COMPLETED" }).sort({ endedAt: -1 }).limit(take).toArray();
  const items = [];
  for (const m of recentMatches) {
    const full = await loadMatchWithRelations(clubId, m.id as string);
    items.push(serializeMatch(full));
  }
  return items;
}

export async function liveForClub(clubId: string) {
  const liveMatches = await matches().find({ clubId, status: "IN_PROGRESS" }).toArray();
  const items = [];
  for (const m of liveMatches) {
    const full = await loadMatchWithRelations(clubId, m.id as string);
    items.push(serializeMatch(full));
  }
  return items;
}

function teamPlayerIds(match: MatchWithRelations, idx: number): string[] {
  const team = match.teams.find((t) => t.teamIndex === idx);
  return team ? team.players.map((p) => p.userId) : [];
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

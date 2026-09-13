import { tournaments, tournamentParticipants, tournamentMatches, playerRatings, users } from "@/server/db";
import { ApiError } from "@/lib/api";
import { scoreToString, parseScoreString, validateMatchSets } from "@/lib/engines/scoring";
import { postTransaction } from "./wallets";
import { notify } from "./notifications";
import { audit } from "./audit";
import { cuid } from "@/lib/id";

export async function createTournament(
  clubId: string,
  actor: { id: string },
  input: { name: string; size: number; fee?: number; startsAt?: Date | null }
) {
  if (![4, 8, 16, 32].includes(input.size)) throw ApiError.badRequest("Tournament size must be 4, 8, 16 or 32");
  const t = {
    id: cuid(),
    clubId,
    name: input.name.trim(),
    format: "KNOCKOUT",
    status: "REGISTRATION",
    size: input.size,
    fee: Math.max(0, input.fee ?? 0),
    startsAt: input.startsAt ?? null,
    winnerUserId: null,
    runnerUpUserId: null,
    thirdPlaceUserId: null,
    createdById: actor.id,
    createdAt: new Date(),
    deletedAt: null
  };
  await tournaments().insertOne(t);
  return t;
}

export async function listTournaments(clubId: string) {
  const items = await tournaments().find({ clubId, deletedAt: null }).sort({ createdAt: -1 }).toArray();
  const counts = await tournamentParticipants().aggregate([
    { $match: { tournamentId: { $in: items.map((i) => i.id) } } },
    { $group: { _id: "$tournamentId", count: { $sum: 1 } } }
  ]).toArray();
  const countMap = new Map(counts.map((c) => [c._id, c.count]));
  return items.map((t) => ({ ...t, _count: { participants: countMap.get(t.id) ?? 0 } }));
}

export async function registerParticipant(
  clubId: string,
  tournamentId: string,
  actor: { id: string },
  forUserId?: string
) {
  const t = await tournaments().findOne({ id: tournamentId, clubId });
  if (!t) throw ApiError.notFound("Tournament not found");
  if (t.status !== "REGISTRATION") throw ApiError.conflict("Registration is closed");
  const userId = forUserId ?? actor.id;
  const count = await tournamentParticipants().countDocuments({ tournamentId });
  if (count >= (t.size as number)) throw ApiError.conflict("Tournament is full");
  const existing = await tournamentParticipants().findOne({ tournamentId, userId });
  if (existing) throw ApiError.conflict("Already registered");
  const participant = { id: cuid(), tournamentId, userId, seed: null, eliminatedRound: null };
  await tournamentParticipants().insertOne(participant);
  if ((t.fee as number) > 0) {
    await postTransaction(null, {
      clubId,
      userId,
      amount: -(t.fee as number),
      type: "TOURNAMENT_FEE",
      description: `Entry fee: ${t.name}`,
      relatedType: "Tournament",
      relatedId: tournamentId
    });
  }
  await audit({
    clubId,
    actorUserId: actor.id,
    action: "tournament.registered",
    entityType: "Tournament",
    entityId: tournamentId,
    newValue: { userId }
  });
  return participant;
}

export async function startTournament(clubId: string, tournamentId: string, actor: { id: string }) {
  const t = await tournaments().findOne({ id: tournamentId, clubId });
  if (!t) throw ApiError.notFound("Tournament not found");
  if (t.status !== "REGISTRATION") throw ApiError.conflict("Tournament already started");
  const existingMatches = await tournamentMatches().countDocuments({ tournamentId });
  if (existingMatches > 0) throw ApiError.conflict("Bracket already generated");

  const participants = await tournamentParticipants().find({ tournamentId }).toArray();
  const ratings = await playerRatings().find({ clubId, userId: { $in: participants.map((p) => p.userId as string) } }).toArray();
  const ratingMap = new Map(ratings.map((r) => [r.userId as string, r.rating as number]));
  const seeded = [...participants].sort((a, b) => (ratingMap.get(b.userId as string) ?? 1000) - (ratingMap.get(a.userId as string) ?? 1000));
  await Promise.all(
    seeded.map((p, i) => tournamentParticipants().updateOne({ id: p.id }, { $set: { seed: i + 1 } }))
  );

  const size = t.size as number;
  const totalRounds = Math.log2(size);
  const order = seedOrder(size);
  const slots: (string | null)[] = new Array(size).fill(null);
  for (let i = 0; i < order.length; i++) {
    const seedNo = order[i];
    if (seedNo <= seeded.length) slots[i] = seeded[seedNo - 1].userId as string;
  }

  for (let round = 1; round <= totalRounds; round++) {
    const matchCount = size / Math.pow(2, round);
    const matchDocs = Array.from({ length: matchCount }, (_, slot) => ({
      id: cuid(),
      tournamentId,
      round,
      slot,
      playerAId: null,
      playerBId: null,
      setsText: null,
      winnerId: null,
      status: "PENDING",
      playedMatchId: null
    }));
    await tournamentMatches().insertMany(matchDocs);
  }

  for (let slot = 0; slot < size / 2; slot++) {
    const a = slots[slot * 2];
    const b = slots[slot * 2 + 1];
    await tournamentMatches().updateOne(
      { tournamentId, round: 1, slot },
      { $set: { playerAId: a, playerBId: b, status: a && b ? "READY" : "PENDING" } }
    );
    if (a && !b) await advanceWinner(tournamentId, 1, slot, a);
    else if (!a && b) await advanceWinner(tournamentId, 1, slot, b);
  }

  await tournaments().updateOne(
    { id: tournamentId },
    { $set: { status: "ONGOING", startsAt: t.startsAt ?? new Date() } }
  );
  await audit({
    clubId,
    actorUserId: actor.id,
    action: "tournament.started",
    entityType: "Tournament",
    entityId: tournamentId,
    newValue: { participants: seeded.length }
  });
  for (const p of seeded) {
    await notify({
      userId: p.userId as string,
      clubId,
      type: "TOURNAMENT_ANNOUNCED",
      title: `${t.name} bracket is live`,
      body: `You are seed ${p.seed}. Check the bracket.`
    }).catch(() => {});
  }
  return detail(clubId, tournamentId);
}

export async function submitScore(
  clubId: string,
  tournamentId: string,
  tmId: string,
  actor: { id: string },
  setsText: string
) {
  const tm = await tournamentMatches().findOne({ id: tmId, tournamentId });
  if (!tm) throw ApiError.notFound("Bracket match not found");
  if (tm.status === "COMPLETED") throw ApiError.conflict("Already completed");
  if (!tm.playerAId || !tm.playerBId || tm.status !== "READY") throw ApiError.conflict("Both players must be decided first");
  const sets = parseScoreString(setsText);
  if (!sets) throw ApiError.badRequest("Use format like 21-15, 19-21, 23-21");
  const validation = validateMatchSets(sets);
  if (!validation.ok || !validation.winnerTeam) throw ApiError.badRequest(validation.error ?? "Invalid score");
  const winnerId = validation.winnerTeam === "A" ? tm.playerAId : tm.playerBId;

  await tournamentMatches().updateOne(
    { id: tmId },
    { $set: { setsText: scoreToString(sets), winnerId, status: "COMPLETED" } }
  );

  const t = await tournaments().findOne({ id: tournamentId }, { projection: { name: 1, size: 1 } });
  const finalRound = Math.log2((t?.size as number) ?? 8);

  if ((tm.round as number) === finalRound) {
    const loserId = winnerId === tm.playerAId ? tm.playerBId! : tm.playerAId!;
    await tournaments().updateOne(
      { id: tournamentId },
      { $set: { status: "COMPLETED", winnerUserId: winnerId, runnerUpUserId: loserId } }
    );
    await notify({
      userId: winnerId as string,
      clubId,
      type: "TOURNAMENT_RESULT",
      title: `Champion: ${t?.name ?? "Tournament"}`,
      body: "Congratulations on winning the tournament!"
    });
    await audit({
      clubId,
      actorUserId: actor.id,
      action: "tournament.completed",
      entityType: "Tournament",
      entityId: tournamentId,
      newValue: { winnerId }
    });
  } else {
    await advanceWinner(tournamentId, tm.round as number, tm.slot as number, winnerId as string);
    await notify({
      userId: winnerId as string,
      clubId,
      type: "TOURNAMENT_RESULT",
      title: "You advanced",
      body: `Round ${tm.round} won ${scoreToString(sets)}`
    });
  }

  return tournamentMatches().findOne({ id: tmId });
}

async function advanceWinner(tournamentId: string, round: number, slot: number, winnerId: string): Promise<void> {
  const nextRound = round + 1;
  const nextSlot = Math.floor(slot / 2);
  const isA = slot % 2 === 0;
  const next = await tournamentMatches().findOne({ tournamentId, round: nextRound, slot: nextSlot });
  if (!next) return;
  await tournamentMatches().updateOne(
    { id: next.id },
    { $set: isA ? { playerAId: winnerId } : { playerBId: winnerId } }
  );
  const updated = await tournamentMatches().findOne({ id: next.id });
  if (updated?.playerAId && updated?.playerBId) {
    await tournamentMatches().updateOne({ id: next.id }, { $set: { status: "READY" } });
  }
}

function seedOrder(size: number): number[] {
  let arr = [1, 2];
  while (arr.length < size) {
    const sum = arr.length * 2 + 1;
    const next: number[] = [];
    for (const s of arr) {
      next.push(s, sum - s);
    }
    arr = next;
  }
  return arr;
}

export async function detail(clubId: string, tournamentId: string) {
  const t = await tournaments().findOne({ id: tournamentId, clubId, deletedAt: null });
  if (!t) throw ApiError.notFound("Tournament not found");

  const participants = await tournamentParticipants().aggregate([
    { $match: { tournamentId } },
    { $sort: { seed: 1 } },
    {
      $lookup: {
        from: "users",
        let: { uid: "$userId" },
        pipeline: [
          { $match: { $expr: { $eq: ["$id", "$$uid"] } } },
          { $project: { id: 1, name: 1, photoUrl: 1, _id: 0 } }
        ],
        as: "user"
      }
    },
    { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } }
  ]).toArray();

  const tMatches = await tournamentMatches().find({ tournamentId }).sort({ round: 1, slot: 1 }).toArray();

  const userIds = new Set<string>();
  tMatches.forEach((m) => {
    if (m.playerAId) userIds.add(m.playerAId as string);
    if (m.playerBId) userIds.add(m.playerBId as string);
  });
  const usersList = await users().find({ id: { $in: [...userIds] } }, { projection: { id: 1, name: 1, _id: 0 } }).toArray();
  const nameMap = Object.fromEntries(usersList.map((u) => [u.id, u.name]));
  const totalRounds = Math.log2(t.size as number);
  const rounds: { round: number; matches: unknown[] }[] = [];
  for (let r = 1; r <= totalRounds; r++) {
    rounds.push({
      round: r,
      matches: tMatches.filter((m) => m.round === r)
    });
  }
  return {
    ...t,
    participants,
    matches: tMatches,
    rounds,
    totalRounds,
    names: nameMap
  };
}

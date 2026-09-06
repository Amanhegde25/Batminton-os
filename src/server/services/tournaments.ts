import { prisma } from "@/server/db";
import { ApiError } from "@/lib/api";
import { scoreToString, parseScoreString, validateMatchSets } from "@/lib/engines/scoring";
import { postTransaction } from "./wallets";
import { notify } from "./notifications";
import { audit } from "./audit";

export async function createTournament(
  clubId: string,
  actor: { id: string },
  input: { name: string; size: number; fee?: number; startsAt?: Date | null }
) {
  if (![4, 8, 16, 32].includes(input.size)) throw ApiError.badRequest("Tournament size must be 4, 8, 16 or 32");
  return prisma.tournament.create({
    data: {
      clubId,
      name: input.name.trim(),
      format: "KNOCKOUT",
      size: input.size,
      fee: Math.max(0, input.fee ?? 0),
      startsAt: input.startsAt ?? null,
      createdById: actor.id
    }
  });
}

export async function listTournaments(clubId: string) {
  return prisma.tournament.findMany({
    where: { clubId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { participants: true } } }
  });
}

export async function registerParticipant(
  clubId: string,
  tournamentId: string,
  actor: { id: string },
  forUserId?: string
) {
  const t = await prisma.tournament.findFirst({ where: { id: tournamentId, clubId } });
  if (!t) throw ApiError.notFound("Tournament not found");
  if (t.status !== "REGISTRATION") throw ApiError.conflict("Registration is closed");
  const userId = forUserId ?? actor.id;
  const count = await prisma.tournamentParticipant.count({ where: { tournamentId } });
  if (count >= t.size) throw ApiError.conflict("Tournament is full");
  const existing = await prisma.tournamentParticipant.findUnique({
    where: { tournamentId_userId: { tournamentId, userId } }
  });
  if (existing) throw ApiError.conflict("Already registered");
  const participant = await prisma.tournamentParticipant.create({ data: { tournamentId, userId } });
  if (t.fee > 0) {
    await prisma.$transaction((tx) =>
      postTransaction(tx, {
        clubId,
        userId,
        amount: -t.fee,
        type: "TOURNAMENT_FEE",
        description: `Entry fee: ${t.name}`,
        relatedType: "Tournament",
        relatedId: tournamentId
      })
    );
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
  const t = await prisma.tournament.findFirst({
    where: { id: tournamentId, clubId },
    include: {
      participants: { include: { user: { select: { name: true } } } },
      matches: true
    }
  });
  if (!t) throw ApiError.notFound("Tournament not found");
  if (t.status !== "REGISTRATION") throw ApiError.conflict("Tournament already started");
  if (t.matches.length > 0) throw ApiError.conflict("Bracket already generated");

  const ratings = await prisma.playerRating.findMany({
    where: { clubId, userId: { in: t.participants.map((p) => p.userId) } }
  });
  const ratingMap = new Map(ratings.map((r) => [r.userId, r.rating]));
  const seeded = [...t.participants].sort((a, b) => (ratingMap.get(b.userId) ?? 1000) - (ratingMap.get(a.userId) ?? 1000));
  await Promise.all(
    seeded.map((p, i) => prisma.tournamentParticipant.update({ where: { id: p.id }, data: { seed: i + 1 } }))
  );

  const size = t.size;
  const totalRounds = Math.log2(size);
  const order = seedOrder(size);
  const slots: (string | null)[] = new Array(size).fill(null);
  for (let i = 0; i < order.length; i++) {
    const seedNo = order[i];
    if (seedNo <= seeded.length) slots[i] = seeded[seedNo - 1].userId;
  }

  for (let round = 1; round <= totalRounds; round++) {
    const matchCount = size / Math.pow(2, round);
    await prisma.tournamentMatch.createMany({
      data: Array.from({ length: matchCount }, (_, slot) => ({
        tournamentId,
        round,
        slot
      }))
    });
  }

  for (let slot = 0; slot < size / 2; slot++) {
    const a = slots[slot * 2];
    const b = slots[slot * 2 + 1];
    await prisma.tournamentMatch.updateMany({
      where: { tournamentId, round: 1, slot },
      data: { playerAId: a, playerBId: b, status: a && b ? "READY" : "PENDING" }
    });
    if (a && !b) await advanceWinner(tournamentId, 1, slot, a);
    else if (!a && b) await advanceWinner(tournamentId, 1, slot, b);
  }

  await prisma.tournament.update({ where: { id: tournamentId }, data: { status: "ONGOING", startsAt: t.startsAt ?? new Date() } });
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
      userId: p.userId,
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
  const tm = await prisma.tournamentMatch.findFirst({ where: { id: tmId, tournamentId } });
  if (!tm) throw ApiError.notFound("Bracket match not found");
  if (tm.status === "COMPLETED") throw ApiError.conflict("Already completed");
  if (!tm.playerAId || !tm.playerBId || tm.status !== "READY") throw ApiError.conflict("Both players must be decided first");
  const sets = parseScoreString(setsText);
  if (!sets) throw ApiError.badRequest("Use format like 21-15, 19-21, 23-21");
  const validation = validateMatchSets(sets);
  if (!validation.ok || !validation.winnerTeam) throw ApiError.badRequest(validation.error ?? "Invalid score");
  const winnerId = validation.winnerTeam === "A" ? tm.playerAId : tm.playerBId;

  await prisma.tournamentMatch.update({
    where: { id: tmId },
    data: { setsText: scoreToString(sets), winnerId, status: "COMPLETED" }
  });

  const t = await prisma.tournament.findUnique({ where: { id: tournamentId }, select: { name: true, size: true } });
  const finalRound = Math.log2(t?.size ?? 8);

  if (tm.round === finalRound) {
    const loserId = winnerId === tm.playerAId ? tm.playerBId! : tm.playerAId!;
    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { status: "COMPLETED", winnerUserId: winnerId, runnerUpUserId: loserId }
    });
    await notify({
      userId: winnerId,
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
    await advanceWinner(tournamentId, tm.round, tm.slot, winnerId);
    await notify({
      userId: winnerId,
      clubId,
      type: "TOURNAMENT_RESULT",
      title: "You advanced",
      body: `Round ${tm.round} won ${scoreToString(sets)}`
    });
  }

  return prisma.tournamentMatch.findUnique({ where: { id: tmId } });
}

async function advanceWinner(tournamentId: string, round: number, slot: number, winnerId: string): Promise<void> {
  const nextRound = round + 1;
  const nextSlot = Math.floor(slot / 2);
  const isA = slot % 2 === 0;
  const next = await prisma.tournamentMatch.findUnique({
    where: { tournamentId_round_slot: { tournamentId, round: nextRound, slot: nextSlot } }
  });
  if (!next) return;
  await prisma.tournamentMatch.update({
    where: { id: next.id },
    data: isA ? { playerAId: winnerId } : { playerBId: winnerId }
  });
  const updated = await prisma.tournamentMatch.findUnique({ where: { id: next.id } });
  if (updated?.playerAId && updated?.playerBId) {
    await prisma.tournamentMatch.update({ where: { id: next.id }, data: { status: "READY" } });
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
  const t = await prisma.tournament.findFirst({
    where: { id: tournamentId, clubId, deletedAt: null },
    include: {
      participants: {
        orderBy: { seed: "asc" },
        include: { user: { select: { id: true, name: true, photoUrl: true } } }
      },
      matches: { orderBy: [{ round: "asc" }, { slot: "asc" }] }
    }
  });
  if (!t) throw ApiError.notFound("Tournament not found");
  const userIds = new Set<string>();
  t.matches.forEach((m) => {
    if (m.playerAId) userIds.add(m.playerAId);
    if (m.playerBId) userIds.add(m.playerBId);
  });
  const users = await prisma.user.findMany({ where: { id: { in: [...userIds] } }, select: { id: true, name: true } });
  const nameMap = Object.fromEntries(users.map((u) => [u.id, u.name]));
  const totalRounds = Math.log2(t.size);
  const rounds: { round: number; matches: unknown[] }[] = [];
  for (let r = 1; r <= totalRounds; r++) {
    rounds.push({
      round: r,
      matches: t.matches.filter((m) => m.round === r)
    });
  }
  return {
    ...t,
    rounds,
    totalRounds,
    names: nameMap
  };
}

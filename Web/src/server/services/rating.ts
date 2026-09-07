import { prisma, type Tx } from "@/server/db";
import { getRatingProvider, consistencyScore } from "@/lib/engines/elo";
import { monthStartsBetween } from "@/lib/date";

export async function ensureRating(db: Tx, clubId: string, userId: string) {
  return db.playerRating.upsert({
    where: { clubId_userId: { clubId, userId } },
    create: { clubId, userId },
    update: {}
  });
}

export interface ApplyResultInput {
  clubId: string;
  matchId: string;
  playersA: string[];
  playersB: string[];
  ratingsA?: number[];
  ratingsB?: number[];
  setsWonA: number;
  setsWonB: number;
  pointsA: number;
  pointsB: number;
  walkover?: boolean;
}

export async function applyMatchResultToRatings(db: Tx, input: ApplyResultInput) {
  const allPlayers = [...input.playersA, ...input.playersB];
  const existingRows = await db.playerRating.findMany({
    where: { clubId: input.clubId, userId: { in: allPlayers } }
  });
  const rowMap = new Map(existingRows.map((r) => [r.userId, r]));

  const ratingsA =
    input.ratingsA ?? input.playersA.map((id) => rowMap.get(id)?.rating ?? 1000);
  const ratingsB =
    input.ratingsB ?? input.playersB.map((id) => rowMap.get(id)?.rating ?? 1000);

  const provider = getRatingProvider("elo");
  const out = provider.apply({
    ratingsA,
    ratingsB,
    setsWonA: input.setsWonA,
    setsWonB: input.setsWonB,
    pointsA: input.pointsA,
    pointsB: input.pointsB,
    walkover: input.walkover
  });

  const aWon = input.setsWonA > input.setsWonB || (input.setsWonA === input.setsWonB && input.pointsA > input.pointsB);
  const now = new Date();
  const histories: { userId: string; before: number; after: number; delta: number; won: boolean }[] = [];

  for (let i = 0; i < input.playersA.length; i++) {
    const userId = input.playersA[i];
    await ensureRating(db, input.clubId, userId);
    const after = out.newRatingsA[i];
    const before = ratingsA[i];
    histories.push({ userId, before, after, delta: out.deltaA, won: aWon });
  }
  for (let i = 0; i < input.playersB.length; i++) {
    const userId = input.playersB[i];
    await ensureRating(db, input.clubId, userId);
    const after = out.newRatingsB[i];
    const before = ratingsB[i];
    histories.push({ userId, before, after, delta: out.deltaB, won: !aWon });
  }

  for (const h of histories) {
    const current = rowMap.get(h.userId);
    const newPeak = Math.max(current?.peak ?? h.before, h.after);
    await db.playerRating.update({
      where: { clubId_userId: { clubId: input.clubId, userId: h.userId } },
      data: {
        rating: h.after,
        peak: newPeak,
        wins: { increment: h.won ? 1 : 0 },
        losses: { increment: h.won ? 0 : 1 },
        walkovers: { increment: input.walkover && !h.won ? 1 : 0 },
        matchesPlayed: { increment: 1 },
        lastPlayedAt: now
      }
    });
  }

  await db.ratingHistory.createMany({
    data: histories.map((h) => ({
      clubId: input.clubId,
      userId: h.userId,
      matchId: input.matchId,
      ratingBefore: h.before,
      ratingAfter: h.after,
      delta: h.delta
    }))
  });

  return {
    deltas: Object.fromEntries(histories.map((h) => [h.userId, Math.round(h.delta)])),
    newRatings: Object.fromEntries(histories.map((h) => [h.userId, Math.round(h.after * 10) / 10]))
  };
}

export async function getPlayerRatingCard(clubId: string, userId: string) {
  const rating = await prisma.playerRating.findUnique({
    where: { clubId_userId: { clubId, userId } }
  });
  const history = await prisma.ratingHistory.findMany({
    where: { clubId, userId },
    orderBy: { createdAt: "asc" },
    take: 200
  });
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthlyDelta = history
    .filter((h) => h.createdAt >= thisMonthStart)
    .reduce((s, h) => s + h.delta, 0);
  return {
    rating: rating ? Math.round(rating.rating) : 1000,
    peak: rating ? Math.round(rating.peak) : 1000,
    wins: rating?.wins ?? 0,
    losses: rating?.losses ?? 0,
    matchesPlayed: rating?.matchesPlayed ?? 0,
    winRate: rating && rating.matchesPlayed > 0 ? Math.round((rating.wins / rating.matchesPlayed) * 100) : 0,
    monthlyDelta: Math.round(monthlyDelta),
    consistency: consistencyScore(history.slice(-20).map((h) => h.delta)),
    historyPoints: history.map((h) => ({
      date: h.createdAt.toISOString(),
      value: Math.round(h.ratingAfter),
      delta: Math.round(h.delta * 10) / 10
    })),
    trend: buildMonthlyTrend(history, now)
  };
}

function buildMonthlyTrend(history: { delta: number; createdAt: Date }[], now: Date) {
  if (history.length === 0) return [] as { label: string; value: number }[];
  const months = monthStartsBetween(history[0].createdAt, now).slice(-6);
  return months.map((m) => {
    const value = history
      .filter((h) => h.createdAt.getFullYear() === m.year && h.createdAt.getMonth() + 1 === m.month)
      .reduce((s, h) => s + h.delta, 0);
    return { label: m.label, value: Math.round(value) };
  });
}

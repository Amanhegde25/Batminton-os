import { playerRatings, ratingHistories } from "@/server/db";
import { getRatingProvider, consistencyScore } from "@/lib/engines/elo";
import { monthStartsBetween } from "@/lib/date";
import { cuid } from "@/lib/id";

export async function ensureRating(_db: unknown, clubId: string, userId: string) {
  const existing = await playerRatings().findOne({ clubId, userId });
  if (existing) return existing;
  const rating = {
    id: cuid(),
    clubId,
    userId,
    rating: 1000,
    peak: 1000,
    wins: 0,
    losses: 0,
    walkovers: 0,
    matchesPlayed: 0,
    lastPlayedAt: null
  };
  await playerRatings().insertOne(rating);
  return rating;
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

export async function applyMatchResultToRatings(_db: unknown, input: ApplyResultInput) {
  const allPlayers = [...input.playersA, ...input.playersB];
  const existingRows = await playerRatings().find({ clubId: input.clubId, userId: { $in: allPlayers } }).toArray();
  const rowMap = new Map(existingRows.map((r) => [r.userId as string, r]));

  const ratingsA =
    input.ratingsA ?? input.playersA.map((id) => (rowMap.get(id)?.rating as number) ?? 1000);
  const ratingsB =
    input.ratingsB ?? input.playersB.map((id) => (rowMap.get(id)?.rating as number) ?? 1000);

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
    await ensureRating(null, input.clubId, userId);
    const after = out.newRatingsA[i];
    const before = ratingsA[i];
    histories.push({ userId, before, after, delta: out.deltaA, won: aWon });
  }
  for (let i = 0; i < input.playersB.length; i++) {
    const userId = input.playersB[i];
    await ensureRating(null, input.clubId, userId);
    const after = out.newRatingsB[i];
    const before = ratingsB[i];
    histories.push({ userId, before, after, delta: out.deltaB, won: !aWon });
  }

  for (const h of histories) {
    const current = rowMap.get(h.userId);
    const newPeak = Math.max((current?.peak as number) ?? h.before, h.after);
    await playerRatings().updateOne(
      { clubId: input.clubId, userId: h.userId },
      {
        $set: { rating: h.after, peak: newPeak, lastPlayedAt: now },
        $inc: {
          wins: h.won ? 1 : 0,
          losses: h.won ? 0 : 1,
          walkovers: input.walkover && !h.won ? 1 : 0,
          matchesPlayed: 1
        }
      }
    );
  }

  await ratingHistories().insertMany(
    histories.map((h) => ({
      id: cuid(),
      clubId: input.clubId,
      userId: h.userId,
      matchId: input.matchId,
      ratingBefore: h.before,
      ratingAfter: h.after,
      delta: h.delta,
      createdAt: now
    }))
  );

  return {
    deltas: Object.fromEntries(histories.map((h) => [h.userId, Math.round(h.delta)])),
    newRatings: Object.fromEntries(histories.map((h) => [h.userId, Math.round(h.after * 10) / 10]))
  };
}

export async function getPlayerRatingCard(clubId: string, userId: string) {
  const rating = await playerRatings().findOne({ clubId, userId });
  const history = await ratingHistories().find({ clubId, userId }).sort({ createdAt: 1 }).limit(200).toArray();
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthlyDelta = history
    .filter((h) => (h.createdAt as Date) >= thisMonthStart)
    .reduce((s, h) => s + (h.delta as number), 0);
  return {
    rating: rating ? Math.round(rating.rating as number) : 1000,
    peak: rating ? Math.round(rating.peak as number) : 1000,
    wins: (rating?.wins as number) ?? 0,
    losses: (rating?.losses as number) ?? 0,
    matchesPlayed: (rating?.matchesPlayed as number) ?? 0,
    winRate: rating && (rating.matchesPlayed as number) > 0 ? Math.round(((rating.wins as number) / (rating.matchesPlayed as number)) * 100) : 0,
    monthlyDelta: Math.round(monthlyDelta),
    consistency: consistencyScore(history.slice(-20).map((h) => h.delta as number)),
    historyPoints: history.map((h) => ({
      date: (h.createdAt as Date).toISOString(),
      value: Math.round(h.ratingAfter as number),
      delta: Math.round((h.delta as number) * 10) / 10
    })),
    trend: buildMonthlyTrend(history as any, now)
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

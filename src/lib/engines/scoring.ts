export interface SetScore {
  a: number;
  b: number;
}

export function validateSet(s: SetScore): string | null {
  const { a, b } = s;
  if (!Number.isInteger(a) || !Number.isInteger(b)) return "Scores must be whole numbers";
  if (a < 0 || b < 0) return "Scores cannot be negative";
  if (a === b) return "A set cannot be tied";
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  if (hi > 30) return "Maximum score in a set is 30";
  if (hi === 30) {
    if (lo < 29) return "30 can only be reached at 29-29 deuce";
    return null;
  }
  if (hi < 21) return "A set is won at 21 points or beyond";
  if (hi - lo < 2) return `Winner needs a 2-point lead at ${hi}-${lo}`;
  return null;
}

export function setWinner(s: SetScore): "A" | "B" {
  return s.a > s.b ? "A" : "B";
}

export interface MatchValidation {
  ok: boolean;
  error?: string;
  winnerTeam: "A" | "B" | null;
  setsWonA: number;
  setsWonB: number;
}

export function validateMatchSets(sets: SetScore[], bestOf = 3): MatchValidation {
  const need = Math.floor(bestOf / 2) + 1;
  if (!Array.isArray(sets) || sets.length === 0) {
    return { ok: false, error: "At least one set is required", winnerTeam: null, setsWonA: 0, setsWonB: 0 };
  }
  if (sets.length > bestOf) {
    return { ok: false, error: `Best of ${bestOf} has at most ${bestOf} sets`, winnerTeam: null, setsWonA: 0, setsWonB: 0 };
  }
  let a = 0;
  let b = 0;
  for (let i = 0; i < sets.length; i++) {
    const err = validateSet(sets[i]);
    if (err) return { ok: false, error: `Set ${i + 1}: ${err}`, winnerTeam: null, setsWonA: 0, setsWonB: 0 };
    if (setWinner(sets[i]) === "A") a++;
    else b++;
    if (i + 1 < sets.length && (a >= need || b >= need)) {
      return {
        ok: false,
        error: `Match was decided after ${i + 1} set${i ? "s" : ""}; remove extra sets`,
        winnerTeam: null,
        setsWonA: 0,
        setsWonB: 0
      };
    }
  }
  if (a < need && b < need) {
    return { ok: false, error: `A winner needs ${need} sets`, winnerTeam: null, setsWonA: a, setsWonB: b };
  }
  return { ok: true, winnerTeam: a > b ? "A" : "B", setsWonA: a, setsWonB: b };
}

export function totalPoints(sets: SetScore[]): { forA: number; forB: number; diff: number } {
  const forA = sets.reduce((s, x) => s + x.a, 0);
  const forB = sets.reduce((s, x) => s + x.b, 0);
  return { forA, forB, diff: forA - forB };
}

export function scoreToString(sets: SetScore[]): string {
  return sets.map((s) => `${s.a}-${s.b}`).join(", ");
}

export function parseScoreString(text: string): SetScore[] | null {
  const parts = text.split(",").map((p) => p.trim());
  const sets: SetScore[] = [];
  for (const p of parts) {
    const m = p.match(/^(\d{1,2})\s*[-–:]\s*(\d{1,2})$/);
    if (!m) return null;
    sets.push({ a: parseInt(m[1], 10), b: parseInt(m[2], 10) });
  }
  return sets;
}

type Rng = () => number;

export function randomValidSet(rng: Rng, strengthForA: number): SetScore {
  const strongWins = rng() < strengthForA;
  const extended = rng() < 0.12;
  if (extended) {
    const hi = 21 + Math.floor(rng() * 8);
    const hiScore = Math.min(29, hi);
    const lo = hiScore - 2;
    return strongWins ? { a: hiScore, b: lo } : { a: lo, b: hiScore };
  }
  const loserScore =
    rng() < 0.55 ? 8 + Math.floor(rng() * 9) : rng() < 0.7 ? 17 + Math.floor(rng() * 4) : 19 + Math.floor(rng() * 2);
  const capped = Math.min(loserScore, 19);
  return strongWins ? { a: 21, b: capped } : { a: capped, b: 21 };
}

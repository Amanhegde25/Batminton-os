export interface RatingProvider {
  name: string;
  apply(input: EloInput): EloOutput;
}

export interface EloInput {
  ratingsA: number[];
  ratingsB: number[];
  setsWonA: number;
  setsWonB: number;
  pointsA: number;
  pointsB: number;
  kBase?: number;
  walkover?: boolean;
}

export interface EloOutput {
  newRatingsA: number[];
  newRatingsB: number[];
  deltaA: number;
  deltaB: number;
  expectedA: number;
}

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

export function marginMultiplier(pointDiff: number): number {
  const diff = Math.abs(pointDiff);
  const m = 1 + Math.log(diff + 1) / Math.log(45);
  return Math.min(2, Math.max(1, m));
}

function avg(xs: number[]): number {
  if (xs.length === 0) return 1000;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function applyElo(input: EloInput): EloOutput {
  const teamA = avg(input.ratingsA);
  const teamB = avg(input.ratingsB);
  const expectedA = expectedScore(teamA, teamB);

  let actualA: number;
  if (input.setsWonA > input.setsWonB) actualA = 1;
  else if (input.setsWonA < input.setsWonB) actualA = 0;
  else if (input.pointsA !== input.pointsB) actualA = input.pointsA > input.pointsB ? 1 : 0;
  else actualA = 0.5;

  let k = (input.kBase ?? 32) * marginMultiplier(input.walkover ? 0 : input.pointsA - input.pointsB);
  if (input.walkover) k *= 0.5;
  const deltaA = k * (actualA - expectedA);
  const deltaB = -deltaA;
  return {
    newRatingsA: input.ratingsA.map((r) => r + deltaA),
    newRatingsB: input.ratingsB.map((r) => r + deltaB),
    deltaA,
    deltaB,
    expectedA
  };
}

const eloProvider: RatingProvider = { name: "elo", apply: applyElo };

export function getRatingProvider(name?: string | null): RatingProvider {
  switch ((name ?? "elo").toLowerCase()) {
    case "elo":
      return eloProvider;
    default:
      throw new Error(`Unknown rating provider '${name}'. Supported: elo. Glicko-2/OpenSkill can be registered here.`);
  }
}

export function consistencyScore(deltas: number[]): number {
  if (deltas.length < 3) return 75;
  const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  const variance = deltas.reduce((a, b) => a + (b - mean) ** 2, 0) / deltas.length;
  const stdev = Math.sqrt(variance);
  return Math.round(Math.max(0, Math.min(100, 100 - stdev * 4)));
}

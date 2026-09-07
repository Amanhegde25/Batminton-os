export interface MatchRow {
  id: string;
  date: string;
  won: boolean;
  doubles: boolean;
  pointsFor: number;
  pointsAgainst: number;
  partners: string[];
  opponents: string[];
}

export interface StreakInfo {
  current: { type: "W" | "L"; count: number } | null;
  bestWinStreak: number;
  worstLosingStreak: number;
}

export function computeStreaks(chronologicalWins: boolean[]): StreakInfo {
  let bestWin = 0;
  let worstLoss = 0;
  let curWin = 0;
  let curLoss = 0;
  for (const won of chronologicalWins) {
    if (won) {
      curWin += 1;
      curLoss = 0;
    } else {
      curLoss += 1;
      curWin = 0;
    }
    bestWin = Math.max(bestWin, curWin);
    worstLoss = Math.max(worstLoss, curLoss);
  }
  if (chronologicalWins.length === 0) return { current: null, bestWinStreak: 0, worstLosingStreak: 0 };
  const lastWon = chronologicalWins[chronologicalWins.length - 1];
  let count = 0;
  for (let i = chronologicalWins.length - 1; i >= 0; i--) {
    if (chronologicalWins[i] === lastWon) count++;
    else break;
  }
  return { current: { type: lastWon ? "W" : "L", count }, bestWinStreak: bestWin, worstLosingStreak: worstLoss };
}

export interface PlayerSummary {
  played: number;
  wins: number;
  losses: number;
  winRate: number;
  form: ("W" | "L")[];
  avgPointsFor: number;
  avgPointsAgainst: number;
  avgPointDiff: number;
  streaks: StreakInfo;
}

export function playerSummary(rows: MatchRow[]): PlayerSummary {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const wins = sorted.filter((r) => r.won).length;
  const losses = sorted.length - wins;
  const played = sorted.length;
  const avgPointsFor = played ? Math.round((sorted.reduce((s, r) => s + r.pointsFor, 0) / played) * 10) / 10 : 0;
  const avgPointsAgainst = played ? Math.round((sorted.reduce((s, r) => s + r.pointsAgainst, 0) / played) * 10) / 10 : 0;
  return {
    played,
    wins,
    losses,
    winRate: played ? Math.round((wins / played) * 100) : 0,
    form: sorted.slice(-5).map((r) => (r.won ? "W" : "L")),
    avgPointsFor,
    avgPointsAgainst,
    avgPointDiff: Math.round((avgPointsFor - avgPointsAgainst) * 10) / 10,
    streaks: computeStreaks(sorted.map((r) => r.won))
  };
}

export interface PairAgg {
  key: string;
  played: number;
  wins: number;
  winRate: number;
}

export function aggregateBy(rows: MatchRow[], kind: "partners" | "opponents"): Map<string, PairAgg> {
  const map = new Map<string, PairAgg>();
  for (const row of rows) {
    const ids = kind === "partners" ? row.partners : row.opponents;
    for (const id of ids) {
      const agg = map.get(id) ?? { key: id, played: 0, wins: 0, winRate: 0 };
      agg.played += 1;
      if (row.won) agg.wins += 1;
      agg.winRate = Math.round((agg.wins / agg.played) * 100);
      map.set(id, agg);
    }
  }
  return map;
}

export function headToHead(rows: MatchRow[], opponentId: string): { played: number; wins: number; losses: number } {
  const agg = aggregateBy(rows, "opponents").get(opponentId);
  if (!agg) return { played: 0, wins: 0, losses: 0 };
  return { played: agg.played, wins: agg.wins, losses: agg.played - agg.wins };
}

export interface AttendanceLite {
  day: string;
  status: string;
}

export function attendanceSummary(records: AttendanceLite[], totalDaysInWindow: number): {
  present: number;
  absent: number;
  late: number;
  guest: number;
  excused: number;
  pct: number;
} {
  let present = 0;
  let absent = 0;
  let late = 0;
  let guest = 0;
  let excused = 0;
  for (const r of records) {
    if (r.status === "PRESENT" || r.status === "LATE") present++;
    else if (r.status === "ABSENT") absent++;
    else if (r.status === "GUEST") guest++;
    else if (r.status === "EXCUSED") excused++;
    if (r.status === "LATE") late++;
  }
  const denominator = Math.max(totalDaysInWindow, present + absent);
  return {
    present,
    absent,
    late,
    guest,
    excused,
    pct: denominator ? Math.round((present / denominator) * 100) : 0
  };
}

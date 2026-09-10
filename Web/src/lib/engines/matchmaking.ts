export interface MMPlayer {
  id: string;
  name: string;
  rating: number;
  matchesToday: number;
  checkedInAt: number;
  isAbsent?: boolean;
}

export interface MMAssignment {
  courtIndex: number;
  teamA: MMPlayer[];
  teamB: MMPlayer[];
  explanation: {
    balancePct: number;
    ratingDiff: number;
    partnerRepetition: number;
    opponentRepetition: number;
    fairness: string;
    note: string;
  };
}

export interface MMContext {
  players: MMPlayer[];
  courtsAvailable: number;
  mode: "SINGLES" | "DOUBLES";
  partnerHistory?: Record<string, number>;
  opponentHistory?: Record<string, number>;
}

export interface MMResult {
  assignments: MMAssignment[];
  queue: MMPlayer[];
  summary: {
    usedPlayers: number;
    courtsUsed: number;
    fairness: string;
    mode: string;
    reasonIfEmpty?: string;
  };
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join("|");
}

function avg(xs: number[]): number {
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 1000;
}

function combinations<T>(arr: T[], k: number): T[][] {
  const out: T[][] = [];
  const combo: T[] = [];
  const walk = (start: number) => {
    if (combo.length === k) {
      out.push([...combo]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      walk(i + 1);
      combo.pop();
    }
  };
  walk(0);
  return out;
}

function pairings(players: MMPlayer[]): [MMPlayer[], MMPlayer[]][] {
  if (players.length === 2) return [[[players[0]], [players[1]]]];
  const [p0, p1, p2, p3] = players;
  return [
    [
      [p0, p3],
      [p1, p2]
    ],
    [
      [p0, p2],
      [p1, p3]
    ],
    [
      [p0, p1],
      [p2, p3]
    ]
  ];
}

function assignmentCost(
  teamA: MMPlayer[],
  teamB: MMPlayer[],
  mode: string,
  ctx: MMContext
): { cost: number; partnerRep: number; oppRep: number } {
  const pHist = ctx.partnerHistory ?? {};
  const oHist = ctx.opponentHistory ?? {};
  let partnerRep = 0;
  let oppRep = 0;
  if (mode === "DOUBLES") {
    for (const team of [teamA, teamB]) {
      if (team.length === 2 && (pHist[pairKey(team[0].id, team[1].id)] ?? 0) > 0) partnerRep += 1;
    }
  }
  for (const a of teamA)
    for (const b of teamB) {
      if ((oHist[pairKey(a.id, b.id)] ?? 0) > 0) oppRep += 1;
    }
  const ratings = [...teamA, ...teamB].map((p) => p.rating);
  const spread = Math.max(...ratings) - Math.min(...ratings);
  const fatigueSpread = Math.max(...[...teamA, ...teamB].map((p) => p.matchesToday)) -
    Math.min(...[...teamA, ...teamB].map((p) => p.matchesToday));
  const diff = Math.abs(avg(teamA.map((p) => p.rating)) - avg(teamB.map((p) => p.rating)));
  const cost = diff * 1.0 + partnerRep * 45 + oppRep * 12 + spread * 0.15 + fatigueSpread * 10;
  return { cost, partnerRep, oppRep };
}

function fairnessLabel(matchesTodayValues: number[]): string {
  if (matchesTodayValues.length < 4) return "High";
  const mean = matchesTodayValues.reduce((a, b) => a + b, 0) / matchesTodayValues.length;
  const variance = matchesTodayValues.reduce((a, b) => a + (b - mean) ** 2, 0) / matchesTodayValues.length;
  const stdev = Math.sqrt(variance);
  if (stdev <= 0.35) return "High";
  if (stdev <= 0.75) return "Medium";
  return "Low";
}

export function generateSchedule(ctx: MMContext): MMResult {
  const perMatch = ctx.mode === "DOUBLES" ? 4 : 2;
  const sorted = [...ctx.players].sort(
    (x, y) =>
      x.matchesToday - y.matchesToday || x.checkedInAt - y.checkedInAt || y.rating - x.rating
  );

  const assignments: MMAssignment[] = [];
  const remaining = [...sorted];
  let courtIndex = 0;

  while (remaining.length >= perMatch && courtIndex < ctx.courtsAvailable) {
    const windowSize = Math.min(remaining.length, Math.max(perMatch + 2, 6));
    const window = remaining.slice(0, windowSize);

    let best: { group: MMPlayer[]; teamA: MMPlayer[]; teamB: MMPlayer[]; cost: number; partnerRep: number; oppRep: number } | null =
      null;

    const groups = combinations(window, perMatch);

    for (const group of groups) {
      const options = pairings(group);
      for (const [teamA, teamB] of options) {
        const { cost, partnerRep, oppRep } = assignmentCost(teamA, teamB, ctx.mode, ctx);
        if (!best || cost < best.cost) best = { group, teamA, teamB, cost, partnerRep, oppRep };
      }
    }

    if (!best) break;

    const ratingDiff = Math.abs(
      avg(best.teamA.map((p) => p.rating)) - avg(best.teamB.map((p) => p.rating))
    );
    assignments.push({
      courtIndex,
      teamA: best.teamA,
      teamB: best.teamB,
      explanation: {
        balancePct: Math.max(40, Math.round(100 - ratingDiff * 1.5)),
        ratingDiff: Math.round(ratingDiff),
        partnerRepetition: best.partnerRep,
        opponentRepetition: best.oppRep,
        fairness: fairnessLabel(best.group.map((p) => p.matchesToday)),
        note:
          best.partnerRep === 0 && best.oppRep <= 1
            ? "Fresh pairings with balanced ratings"
            : "Best available option given recent history"
      }
    });

    for (const p of best.group) {
      const idx = remaining.findIndex((r) => r.id === p.id);
      if (idx >= 0) remaining.splice(idx, 1);
    }
    courtIndex++;
  }

  const usedMatches = assignments.flatMap((a) => [...a.teamA, ...a.teamB]).map((p) => p.matchesToday);
  return {
    assignments,
    queue: remaining,
    summary: {
      usedPlayers: assignments.reduce((n, a) => n + a.teamA.length + a.teamB.length, 0),
      courtsUsed: assignments.length,
      fairness: fairnessLabel(usedMatches),
      mode: ctx.mode,
      reasonIfEmpty:
        assignments.length === 0
          ? ctx.players.length < perMatch
            ? `Need at least ${perMatch} available players`
            : "No courts available right now"
          : undefined
    }
  };
}

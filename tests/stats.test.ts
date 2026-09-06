import { describe, expect, it } from "vitest";
import { matchRule, penaltySummary, sumPenaltiesSince } from "../src/lib/engines/penalty-engine";
import {
  aggregateBy,
  attendanceSummary,
  computeStreaks,
  headToHead,
  playerSummary,
  type MatchRow
} from "../src/lib/engines/stats";

describe("matchRule", () => {
  const rules = [
    { eventType: "LATE", label: "Late arrival", amount: 1000, enabled: true },
    { eventType: "ABSENCE", label: "No show", amount: 2000, enabled: true },
    { eventType: "LOSS", label: "Match loss", amount: 0, enabled: true },
    { eventType: "WALKOVER", label: "Walkover", amount: 3000, enabled: false }
  ];

  it("prefers an exact label match", () => {
    expect(matchRule(rules, "LATE", "Late arrival")?.amount).toBe(1000);
    expect(matchRule(rules, "ABSENCE", "No show")?.eventType).toBe("ABSENCE");
  });

  it("falls back to any rule of the event type", () => {
    expect(matchRule(rules, "ABSENCE")?.label).toBe("No show");
  });

  it("ignores disabled and zero-amount rules", () => {
    expect(matchRule(rules, "WALKOVER")).toBeNull();
    expect(matchRule(rules, "LOSS")).toBeNull();
    expect(matchRule([], "LATE")).toBeNull();
  });
});

describe("sumPenaltiesSince / penaltySummary", () => {
  const now = new Date(2026, 7, 23, 15, 0, 0);
  const items = (dates: (Date | string)[]) => dates.map((d) => ({ amount: 100, createdAt: d }));

  it("filters by cutoff date", () => {
    const since = new Date(2026, 7, 20);
    expect(sumPenaltiesSince(items([new Date(2026, 6, 1), new Date(2026, 7, 21), "2026-07-05T00:00:00Z"]), since)).toBe(100);
    expect(sumPenaltiesSince(items([]), since)).toBe(0);
    expect(sumPenaltiesSince(items([new Date(2025, 0, 1)]), null)).toBe(100);
  });

  it("buckets into today/week/month/year/allTime", () => {
    const result = penaltySummary(
      items([
        new Date(2026, 7, 23, 9),
        new Date(2026, 7, 21),
        new Date(2026, 7, 2),
        new Date(2026, 1, 10),
        new Date(2024, 3, 3)
      ]),
      now
    );
    expect(result.today).toBe(100);
    expect(result.week).toBe(200);
    expect(result.month).toBe(300);
    expect(result.year).toBe(400);
    expect(result.allTime).toBe(500);
  });
});

describe("computeStreaks", () => {
  it("handles empty history", () => {
    expect(computeStreaks([])).toEqual({ current: null, bestWinStreak: 0, worstLosingStreak: 0 });
  });

  it("tracks current, best and worst streaks", () => {
    const r = computeStreaks([true, true, false, false, false, true]);
    expect(r.current).toEqual({ type: "W", count: 1 });
    expect(r.bestWinStreak).toBe(2);
    expect(r.worstLosingStreak).toBe(3);
  });

  it("reports all-loss runs", () => {
    const r = computeStreaks([false, false]);
    expect(r.current).toEqual({ type: "L", count: 2 });
    expect(r.worstLosingStreak).toBe(2);
  });
});

describe("playerSummary", () => {
  const row = (id: string, date: string, won: boolean, pf: number, pa: number): MatchRow => ({
    id,
    date,
    won,
    doubles: true,
    pointsFor: pf,
    pointsAgainst: pa,
    partners: [],
    opponents: []
  });

  const rows = [
    row("m1", "2026-08-01", true, 42, 30),
    row("m2", "2026-08-03", true, 44, 38),
    row("m3", "2026-08-05", false, 35, 42)
  ];

  it("computes record, form and averages", () => {
    const s = playerSummary(rows);
    expect(s.played).toBe(3);
    expect(s.wins).toBe(2);
    expect(s.losses).toBe(1);
    expect(s.winRate).toBe(67);
    expect(s.form).toEqual(["W", "W", "L"]);
    expect(s.avgPointsFor).toBeCloseTo(40.3);
    expect(s.avgPointsAgainst).toBeCloseTo(36.7);
    expect(s.avgPointDiff).toBe(3.6);
    expect(s.streaks.current?.type).toBe("L");
  });

  it("sorts by date regardless of input order", () => {
    const s = playerSummary([rows[2], rows[0], rows[1]]);
    expect(s.form).toEqual(["W", "W", "L"]);
  });

  it("handles empty input", () => {
    const s = playerSummary([]);
    expect(s.played).toBe(0);
    expect(Number.isNaN(s.winRate) === false || s.winRate === 0).toBe(true);
  });
});

describe("aggregateBy / headToHead", () => {
  const rows: MatchRow[] = [
    {
      id: "m1",
      date: "2026-08-01",
      won: true,
      doubles: true,
      pointsFor: 42,
      pointsAgainst: 30,
      partners: ["partnerA"],
      opponents: ["rival"]
    },
    {
      id: "m2",
      date: "2026-08-02",
      won: false,
      doubles: true,
      pointsFor: 31,
      pointsAgainst: 43,
      partners: ["partnerA"],
      opponents: ["rival", "other"]
    },
    {
      id: "m3",
      date: "2026-08-03",
      won: true,
      doubles: false,
      pointsFor: 21,
      pointsAgainst: 18,
      partners: [],
      opponents: ["other"]
    }
  ];

  it("aggregates partner records", () => {
    const map = aggregateBy(rows, "partners");
    const a = map.get("partnerA");
    expect(a).toBeDefined();
    if (!a) return;
    expect(a.played).toBe(2);
    expect(a.wins).toBe(1);
  });

  it("aggregates opponent matchups", () => {
    const map = aggregateBy(rows, "opponents");
    const rival = map.get("rival");
    const other = map.get("other");
    expect(rival).toMatchObject({ key: "rival", played: 2, wins: 1, winRate: 50 });
    expect(other).toMatchObject({ key: "other", played: 2, wins: 1, winRate: 50 });
    expect(map.get("nobody")).toBeUndefined();
  });

  it("computes head-to-head", () => {
    expect(headToHead(rows, "rival")).toEqual({ played: 2, wins: 1, losses: 1 });
    expect(headToHead(rows, "nobody")).toEqual({ played: 0, wins: 0, losses: 0 });
  });
});

describe("attendanceSummary", () => {
  it("summarises statuses and pct over the window", () => {
    const r = attendanceSummary(
      [
        { day: "2026-08-20", status: "PRESENT" },
        { day: "2026-08-21", status: "LATE" },
        { day: "2026-08-22", status: "ABSENT" }
      ],
      5
    );
    expect(r.present).toBe(2);
    expect(r.late).toBe(1);
    expect(r.absent).toBe(1);
    expect(r.guest).toBe(0);
    expect(r.excused).toBe(0);
    expect(r.pct).toBe(40);
  });

  it("falls back to record count when window is smaller", () => {
    const r = attendanceSummary(
      [
        { day: "d1", status: "PRESENT" },
        { day: "d2", status: "ABSENT" }
      ],
      1
    );
    expect(r.pct).toBe(50);
  });
});

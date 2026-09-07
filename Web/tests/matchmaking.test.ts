import { describe, expect, it } from "vitest";
import { generateSchedule, type MMContext, type MMPlayer } from "../src/lib/engines/matchmaking";

function player(i: number, rating: number, matchesToday = 0): MMPlayer {
  return { id: `p${i}`, name: `Player ${i}`, rating, matchesToday, checkedInAt: i * 1000 };
}

const ctx = (players: MMPlayer[], courtsAvailable: number, mode: "SINGLES" | "DOUBLES" = "DOUBLES"): MMContext => ({
  players,
  courtsAvailable,
  mode
});

describe("generateSchedule", () => {
  it("returns empty result with reason when too few players", () => {
    const r = generateSchedule(ctx([player(1, 1000), player(2, 1050)], 2));
    expect(r.assignments).toHaveLength(0);
    expect(r.queue).toHaveLength(2);
    expect(r.summary.reasonIfEmpty).toMatch(/at least 4/);
  });

  it("returns empty result with court reason when no courts", () => {
    const r = generateSchedule(ctx([player(1, 1000), player(2, 1000), player(3, 1010), player(4, 1020)], 0));
    expect(r.assignments).toHaveLength(0);
    expect(r.summary.reasonIfEmpty).toMatch(/No courts available/i);
  });

  it("fills one doubles court with exactly four players", () => {
    const players = [1, 2, 3, 4].map((i) => player(i, 1000 + i * 10));
    const r = generateSchedule(ctx(players, 2));
    expect(r.assignments).toHaveLength(1);
    expect(r.summary.usedPlayers).toBe(4);
    const used = [...r.assignments[0].teamA, ...r.assignments[0].teamB];
    expect(new Set(used.map((p) => p.id)).size).toBe(4);
    expect(r.queue).toHaveLength(0);
  });

  it("respects court limits and queues leftovers", () => {
    const players = Array.from({ length: 12 }, (_, i) => player(i + 1, 950 + i * 25));
    const r = generateSchedule(ctx(players, 2));
    expect(r.assignments).toHaveLength(2);
    expect(r.summary.courtsUsed).toBe(2);
    expect(r.summary.usedPlayers).toBe(8);
    expect(r.queue).toHaveLength(4);
  });

  it("prioritises rested players over high-match-count players", () => {
    const fresh = [1, 2, 3, 4].map((i) => player(i, 1200, 0));
    const tired = [5, 6, 7, 8].map((i) => player(i, 1400, 5));
    const r = generateSchedule(ctx([...tired, ...fresh], 1));
    const usedIds = [...r.assignments[0].teamA, ...r.assignments[0].teamB].map((p) => p.id);
    expect(usedIds.every((id) => ["p1", "p2", "p3", "p4"].includes(id))).toBe(true);
    expect(r.queue.map((p) => p.id).sort()).toEqual(["p5", "p6", "p7", "p8"]);
  });

  it("avoids repeating partnerships given history", () => {
    const players = [1, 2, 3, 4].map((i) => player(i, 1000 + i * 5));
    const hist: Record<string, number> = { "p1|p2": 3 };
    const r = generateSchedule({ ...ctx(players, 1), partnerHistory: hist });
    const teamAIds = r.assignments[0].teamA.map((p) => p.id).sort();
    const teamBIds = r.assignments[0].teamB.map((p) => p.id).sort();
    for (const team of [teamAIds, teamBIds]) {
      if (team.includes("p1") && team.includes("p2")) {
        throw new Error("Repeated partnership despite history penalty");
      }
    }
  });

  it("balances teams closely on rating diff", () => {
    const players = [
      player(1, 1300),
      player(2, 1250),
      player(3, 1100),
      player(4, 1050)
    ];
    const r = generateSchedule(ctx(players, 1));
    const a = r.assignments[0].teamA.reduce((s, p) => s + p.rating, 0);
    const b = r.assignments[0].teamB.reduce((s, p) => s + p.rating, 0);
    expect(Math.abs(a - b)).toBeLessThanOrEqual(150);
  });

  it("supports singles with pairs of one", () => {
    const players = [1, 2, 3, 4, 5].map((i) => player(i, 1000 + i));
    const r = generateSchedule(ctx(players, 2, "SINGLES"));
    expect(r.assignments).toHaveLength(2);
    for (const a of r.assignments) {
      expect(a.teamA).toHaveLength(1);
      expect(a.teamB).toHaveLength(1);
    }
    expect(r.queue).toHaveLength(1);
    expect(r.summary.mode).toBe("SINGLES");
  });

  it("reports fairness labels", () => {
    const players = Array.from({ length: 8 }, (_, i) => player(i + 1, 1000, i % 2));
    const r = generateSchedule(ctx(players, 2));
    expect(["High", "Medium", "Low"]).toContain(r.summary.fairness);
    expect(typeof r.assignments[0].explanation.balancePct).toBe("number");
  });
});

import { describe, expect, it } from "vitest";
import { applyElo, consistencyScore, expectedScore, getRatingProvider, marginMultiplier } from "../src/lib/engines/elo";

describe("expectedScore", () => {
  it("is symmetric and 0.5 at parity", () => {
    expect(expectedScore(1000, 1000)).toBeCloseTo(0.5);
    expect(expectedScore(1200, 1000)).toBeCloseTo(1 - expectedScore(1000, 1200));
  });

  it("favours the stronger player", () => {
    expect(expectedScore(1400, 1000)).toBeGreaterThan(0.8);
  });
});

describe("marginMultiplier", () => {
  it("stays within [1,2] and grows with margin", () => {
    expect(marginMultiplier(0)).toBe(1);
    const small = marginMultiplier(5);
    const big = marginMultiplier(45);
    expect(small).toBeGreaterThan(1);
    expect(big).toBeGreaterThan(small);
    expect(marginMultiplier(100000)).toBeLessThanOrEqual(2);
    expect(marginMultiplier(-30)).toBe(marginMultiplier(30));
  });
});

describe("applyElo", () => {
  const base = {
    ratingsA: [1100, 1050],
    ratingsB: [1000, 980],
    setsWonA: 2,
    setsWonB: 0,
    pointsA: 42,
    pointsB: 25
  };

  it("is zero-sum across all players", () => {
    const out = applyElo(base);
    const before = [...base.ratingsA, ...base.ratingsB].reduce((a, b) => a + b, 0);
    const after = [...out.newRatingsA, ...out.newRatingsB].reduce((a, b) => a + b, 0);
    expect(after - before).toBeCloseTo(0, 6);
    expect(out.deltaA).toBeCloseTo(-out.deltaB, 6);
  });

  it("rewards the winner and preserves order within a team", () => {
    const out = applyElo(base);
    out.newRatingsA.forEach((r, i) => expect(r).toBeGreaterThan(base.ratingsA[i]));
    out.newRatingsB.forEach((r, i) => expect(r).toBeLessThan(base.ratingsB[i]));
    expect(out.newRatingsA[0]).toBeGreaterThan(out.newRatingsA[1]);
  });

  it("applies bigger swings for bigger margins", () => {
    const close = applyElo({ ...base, pointsA: 42, pointsB: 40 });
    const dominant = applyElo({ ...base, pointsA: 42, pointsB: 20 });
    expect(Math.abs(dominant.deltaA)).toBeGreaterThan(Math.abs(close.deltaA));
  });

  it("halves K on walkovers", () => {
    const normalZeroMargin = applyElo({ ...base, pointsB: base.pointsA });
    const wo = applyElo({ ...base, walkover: true });
    expect(Math.abs(wo.deltaA)).toBeCloseTo(Math.abs(normalZeroMargin.deltaA) / 2, 6);
    expect(Math.abs(wo.deltaA)).toBeLessThan(Math.abs(normalZeroMargin.deltaA));
  });

  it("handles singles teams of one and equal ratings draws", () => {
    const draw = applyElo({
      ratingsA: [1000],
      ratingsB: [1000],
      setsWonA: 1,
      setsWonB: 1,
      pointsA: 42,
      pointsB: 42
    });
    expect(draw.expectedA).toBeCloseTo(0.5);
    expect(draw.deltaA).toBeCloseTo(0, 6);
  });

  it("provider registry resolves elo and rejects unknowns", () => {
    expect(getRatingProvider().name).toBe("elo");
    expect(getRatingProvider("ELO").apply).toBeTypeOf("function");
    expect(() => getRatingProvider("glicko")).toThrow(/Unknown rating provider/);
  });
});

describe("consistencyScore", () => {
  it("returns 75 for short histories", () => {
    expect(consistencyScore([10])).toBe(75);
    expect(consistencyScore([])).toBe(75);
  });

  it("scores steady players above streaky ones", () => {
    const steady = consistencyScore([-8, -9, -8, -9, -8]);
    const streaky = consistencyScore([-30, 5, -25, 10, -28]);
    expect(steady).toBeGreaterThan(streaky);
    expect(steady).toBeLessThanOrEqual(100);
  });
});

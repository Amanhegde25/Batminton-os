import { describe, expect, it } from "vitest";
import {
  parseScoreString,
  randomValidSet,
  scoreToString,
  setWinner,
  totalPoints,
  validateMatchSets,
  validateSet
} from "../src/lib/engines/scoring";

describe("validateSet", () => {
  it("accepts standard sets", () => {
    expect(validateSet({ a: 21, b: 15 })).toBeNull();
    expect(validateSet({ a: 19, b: 21 })).toBeNull();
    expect(validateSet({ a: 30, b: 29 })).toBeNull();
    expect(validateSet({ a: 23, b: 21 })).toBeNull();
  });

  it("rejects invalid sets", () => {
    expect(validateSet({ a: 21, b: 21 })).toMatch(/tied/i);
    expect(validateSet({ a: 20, b: 18 })).toMatch(/21 points/);
    expect(validateSet({ a: 21, b: 20 })).toMatch(/2-point lead/i);
    expect(validateSet({ a: 30, b: 15 })).toMatch(/29-29/i);
    expect(validateSet({ a: 31, b: 5 })).toMatch(/Maximum/);
    expect(validateSet({ a: -1, b: 5 })).toMatch(/negative/i);
    expect(validateSet({ a: 1.5, b: 21 })).toMatch(/whole numbers/i);
  });
});

describe("validateMatchSets", () => {
  it("accepts straight-set wins", () => {
    const v = validateMatchSets([
      { a: 21, b: 10 },
      { a: 21, b: 19 }
    ]);
    expect(v.ok).toBe(true);
    expect(v.winnerTeam).toBe("A");
    expect(v.setsWonA).toBe(2);
  });

  it("accepts three-set comebacks", () => {
    const v = validateMatchSets([
      { a: 21, b: 8 },
      { a: 12, b: 21 },
      { a: 23, b: 21 }
    ]);
    expect(v.ok).toBe(true);
    expect(v.winnerTeam).toBe("A");
  });

  it("rejects extra sets after decision", () => {
    const v = validateMatchSets([
      { a: 21, b: 5 },
      { a: 21, b: 5 },
      { a: 21, b: 5 }
    ]);
    expect(v.ok).toBe(false);
    expect(v.error).toMatch(/decided after 2 sets/);
  });

  it("rejects undecided matches", () => {
    const v = validateMatchSets([
      { a: 21, b: 5 },
      { a: 5, b: 21 }
    ]);
    expect(v.ok).toBe(false);
    expect(v.error).toMatch(/needs 2 sets/);
  });

  it("rejects empty input", () => {
    expect(validateMatchSets([]).ok).toBe(false);
  });
});

describe("parse/score helpers", () => {
  it("round-trips score strings", () => {
    const sets = [
      { a: 21, b: 15 },
      { a: 19, b: 21 },
      { a: 24, b: 22 }
    ];
    expect(parseScoreString(scoreToString(sets))).toEqual(sets);
  });

  it("parses unicode dashes and colons", () => {
    expect(parseScoreString("21–15, 19:21")).toEqual([
      { a: 21, b: 15 },
      { a: 19, b: 21 }
    ]);
  });

  it("returns null for garbage", () => {
    expect(parseScoreString("hello world")).toBeNull();
    expect(parseScoreString("21-15, oops")).toBeNull();
  });

  it("totals points", () => {
    expect(totalPoints([{ a: 21, b: 15 }, { a: 10, b: 21 }, { a: 23, b: 21 }])).toEqual({
      forA: 54,
      forB: 57,
      diff: -3
    });
  });
});

describe("randomValidSet", () => {
  it("always produces rule-valid sets", () => {
    let state = 42;
    const rng = () => {
      state = (state * 1103515245 + 12345) % 2147483648;
      return state / 2147483648;
    };
    for (let i = 0; i < 500; i++) {
      expect(validateSet(randomValidSet(rng, rng()))).toBeNull();
    }
  });

  it("respects strength bias directionally over many samples", () => {
    let state = 7;
    const rng = () => {
      state = (state * 48271) % 2147483647;
      return state / 2147483647;
    };
    let count = 0;
    for (let i = 0; i < 300; i++) {
      const s = randomValidSet(rng, 0.95);
      if (setWinner(s) === "A") count++;
    }
    expect(count / 300).toBeGreaterThan(0.75);
  });
});

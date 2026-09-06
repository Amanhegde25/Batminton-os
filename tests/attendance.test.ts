import { describe, expect, it } from "vitest";
import { attendancePct, attendanceStatusForCheckIn, qrTokenPayload } from "../src/lib/engines/attendance-rules";

describe("attendanceStatusForCheckIn", () => {
  const start = 18 * 60;

  it("marks PRESENT at or before grace window", () => {
    expect(attendanceStatusForCheckIn(start - 30, start, 10)).toBe("PRESENT");
    expect(attendanceStatusForCheckIn(start, start, 10)).toBe("PRESENT");
    expect(attendanceStatusForCheckIn(start + 10, start, 10)).toBe("PRESENT");
  });

  it("marks LATE after the grace window", () => {
    expect(attendanceStatusForCheckIn(start + 11, start, 10)).toBe("LATE");
    expect(attendanceStatusForCheckIn(22 * 60, start, 0)).toBe("LATE");
  });

  it("treats negative grace as zero", () => {
    expect(attendanceStatusForCheckIn(start + 1, start, -5)).toBe("LATE");
  });
});

describe("attendancePct", () => {
  it("counts present/late/guest as attended", () => {
    const records = [{ status: "PRESENT" }, { status: "LATE" }, { status: "GUEST" }, { status: "ABSENT" }];
    const r = attendancePct(records, 4);
    expect(r.attendedDays).toBe(3);
    expect(r.expectedDays).toBe(4);
    expect(r.pct).toBe(75);
  });

  it("never divides by zero", () => {
    expect(attendancePct([], 0).pct).toBe(0);
    expect(attendancePct([], 0).expectedDays).toBe(1);
  });

  it("rounds to whole percent", () => {
    const records = [{ status: "PRESENT" }, { status: "ABSENT" }, { status: "ABSENT" }];
    expect(attendancePct(records, 7).pct).toBe(14);
  });
});

describe("qrTokenPayload", () => {
  it("round-trips a valid token", () => {
    const payload = { clubId: "club1", userId: "user9", day: "2026-08-23" };
    const token = Buffer.from(JSON.stringify(payload)).toString("base64url");
    expect(qrTokenPayload(token)).toEqual(payload);
  });

  it("rejects malformed payloads", () => {
    expect(qrTokenPayload(Buffer.from('{"clubId":1}').toString("base64url"))).toBeNull();
    expect(qrTokenPayload("not-a-token!!")).toBeNull();
    expect(qrTokenPayload("")).toBeNull();
  });
});

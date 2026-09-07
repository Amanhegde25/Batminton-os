export function attendanceStatusForCheckIn(
  nowMinutes: number,
  startMinutes: number,
  graceMinutes: number
): "PRESENT" | "LATE" {
  if (nowMinutes <= startMinutes + Math.max(0, graceMinutes)) return "PRESENT";
  return "LATE";
}

export interface AttendanceWindowResult {
  expectedDays: number;
  attendedDays: number;
  pct: number;
}

export function attendancePct(recordsInWindow: { status: string }[], calendarDaysElapsed: number): AttendanceWindowResult {
  let attended = 0;
  for (const r of recordsInWindow) {
    if (r.status === "PRESENT" || r.status === "LATE" || r.status === "GUEST") attended++;
  }
  const expected = Math.max(1, calendarDaysElapsed);
  return { expectedDays: expected, attendedDays: attended, pct: Math.round((attended / expected) * 100) };
}

export function qrTokenPayload(token: string): { clubId: string; userId: string; day: string } | null {
  try {
    const json = Buffer.from(token, "base64url").toString();
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed.clubId === "string" && typeof parsed.userId === "string" && typeof parsed.day === "string") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

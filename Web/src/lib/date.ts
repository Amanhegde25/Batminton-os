export function dayKey(d: Date | string = new Date()): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function startOfDay(d: Date | string = new Date()): Date {
  const date = typeof d === "string" ? new Date(`${d}T00:00:00`) : new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function endOfDay(d: Date | string = new Date()): Date {
  const date = startOfDay(d);
  date.setDate(date.getDate() + 1);
  return date;
}

export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function startOfWeek(d: Date = new Date()): Date {
  const date = startOfDay(d);
  const dow = (date.getDay() + 6) % 7;
  return addDays(date, -dow);
}

export function startOfMonth(d: Date = new Date()): Date {
  const date = startOfDay(d);
  date.setDate(1);
  return date;
}

export function startOfYear(d: Date = new Date()): Date {
  const date = startOfMonth(d);
  date.setMonth(0);
  return date;
}

export type PeriodKey = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY" | "ALL_TIME";

export function periodRange(period: PeriodKey, now: Date = new Date()): { from: Date | null; to: Date } {
  switch (period) {
    case "DAILY":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "WEEKLY":
      return { from: startOfWeek(now), to: endOfDay(now) };
    case "MONTHLY":
      return { from: startOfMonth(now), to: endOfDay(now) };
    case "YEARLY":
      return { from: startOfYear(now), to: endOfDay(now) };
    default:
      return { from: null, to: endOfDay(now) };
  }
}

export function monthStartsBetween(from: Date, to: Date): { year: number; month: number; label: string }[] {
  const out: { year: number; month: number; label: string }[] = [];
  const cur = startOfMonth(from);
  while (cur <= to) {
    out.push({
      year: cur.getFullYear(),
      month: cur.getMonth() + 1,
      label: cur.toLocaleString("en-IN", { month: "short", year: "numeric" })
    });
    cur.setMonth(cur.getMonth() + 1);
  }
  return out;
}

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

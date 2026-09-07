export interface RuleLite {
  eventType: string;
  label?: string;
  amount: number;
  enabled: boolean;
}

export function matchRule(rules: RuleLite[], eventType: string, label?: string): RuleLite | null {
  const enabled = rules.filter((r) => r.enabled && r.amount > 0);
  if (label) {
    const exact = enabled.find((r) => r.eventType === eventType && r.label === label);
    if (exact) return exact;
  }
  return enabled.find((r) => r.eventType === eventType) ?? null;
}

export interface PenaltyItem {
  amount: number;
  createdAt: Date | string;
}

export function sumPenaltiesSince(items: PenaltyItem[], since: Date | null): number {
  return items.reduce((total, p) => {
    const t = typeof p.createdAt === "string" ? new Date(p.createdAt) : p.createdAt;
    if (!since || t >= since) return total + p.amount;
    return total;
  }, 0);
}

export function penaltySummary(items: PenaltyItem[], now: Date): {
  today: number;
  week: number;
  month: number;
  year: number;
  allTime: number;
} {
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const week = new Date(startToday);
  week.setDate(week.getDate() - ((week.getDay() + 6) % 7));
  const month = new Date(startToday.getFullYear(), startToday.getMonth(), 1);
  const year = new Date(startToday.getFullYear(), 0, 1);
  return {
    today: sumPenaltiesSince(items, startToday),
    week: sumPenaltiesSince(items, week),
    month: sumPenaltiesSince(items, month),
    year: sumPenaltiesSince(items, year),
    allTime: sumPenaltiesSince(items, null)
  };
}

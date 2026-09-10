export const APP_NAME = "Badminton Club OS";

export type Plan = "FREE";
export const PLANS: Plan[] = ["FREE"];
export const PLAN_RANK: Record<Plan, number> = { FREE: 0 };
export const PLAN_META: Record<Plan, { label: string; priceINR: string; blurb: string }> = {
  FREE: { label: "Free", priceINR: "₹0", blurb: "All features included — completely free." }
};

export const FEATURES = {
  MEMBERS: "MEMBERS",
  ATTENDANCE: "ATTENDANCE",
  MATCHES: "MATCHES",
  LEADERBOARD: "LEADERBOARD",
  WALLET: "WALLET",
  PENALTIES: "PENALTIES",
  COURTS: "COURTS",
  BOOKINGS: "BOOKINGS",
  MATCHMAKING: "MATCHMAKING",
  ANALYTICS_ADVANCED: "ANALYTICS_ADVANCED",
  TOURNAMENTS: "TOURNAMENTS",
  NOTIFICATIONS: "NOTIFICATIONS",
  AI_COACHING: "AI_COACHING",
  VIDEO_ANALYSIS: "VIDEO_ANALYSIS"
} as const;
export type Feature = keyof typeof FEATURES;

export const FEATURE_MIN_PLAN: Record<string, Plan> = {
  MEMBERS: "FREE",
  ATTENDANCE: "FREE",
  MATCHES: "FREE",
  LEADERBOARD: "FREE",
  WALLET: "FREE",
  NOTIFICATIONS: "FREE",
  PENALTIES: "FREE",
  COURTS: "FREE",
  BOOKINGS: "FREE",
  MATCHMAKING: "FREE",
  ANALYTICS_ADVANCED: "FREE",
  TOURNAMENTS: "FREE",
  AI_COACHING: "FREE",
  VIDEO_ANALYSIS: "FREE"
};

export const PLAN_LIMITS: Record<Plan, { maxMembers: number; maxCourts: number }> = {
  FREE: { maxMembers: 5000, maxCourts: 64 }
};

export function planAllows(plan: string, feature: Feature): boolean {
  const min = FEATURE_MIN_PLAN[feature] ?? "FREE";
  return (PLAN_RANK[plan as Plan] ?? 0) >= PLAN_RANK[min];
}

export function featuresFor(plan: string): string[] {
  return Object.keys(FEATURE_MIN_PLAN).filter((f) => planAllows(plan, f as Feature));
}

export const USER_ROLES = ["SUPER_ADMIN", "PLAYER"] as const;
export const CLUB_ROLES = ["OWNER", "ADMIN", "COACH", "PLAYER"] as const;
export type ClubRole = (typeof CLUB_ROLES)[number];
export const MANAGER_ROLES: ClubRole[] = ["OWNER", "ADMIN"];
export const STAFF_ROLES: ClubRole[] = ["OWNER", "ADMIN", "COACH"];

export const MEMBER_STATUSES = ["ACTIVE", "PENDING", "BLOCKED", "REMOVED"] as const;

export const ATTENDANCE_STATUSES = ["PRESENT", "ABSENT", "LATE", "GUEST", "EXCUSED"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];
export const CHECKIN_METHODS = ["MANUAL", "QR", "GPS", "AUTO"] as const;

export const MATCH_TYPES = ["SINGLES", "DOUBLES"] as const;
export const MATCH_STATUSES = ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "WALKOVER", "CANCELLED"] as const;

export const COURT_STATUSES = ["AVAILABLE", "OCCUPIED", "MAINTENANCE", "DISABLED"] as const;
export const COURT_TYPES = ["SYNTHETIC", "WOODEN", "CEMENT", "OUTDOOR"] as const;

export const BOOKING_STATUSES = ["CONFIRMED", "CANCELLED", "COMPLETED"] as const;
export const PAYMENT_STATUSES = ["FREE", "PAID", "PENDING", "REFUNDED"] as const;

export const TXN_TYPES = [
  "OPENING_CREDIT",
  "MANUAL_CREDIT",
  "MANUAL_DEBIT",
  "REFUND",
  "PENALTY_ATTENDANCE",
  "PENALTY_LATE",
  "PENALTY_LOSS",
  "PENALTY_WALKOVER",
  "PENALTY_OTHER",
  "COURT_FEE",
  "BOOKING_FEE",
  "TOURNAMENT_FEE",
  "MEMBERSHIP_FEE",
  "OTHER"
] as const;
export type TxnType = (typeof TXN_TYPES)[number];
export const CREDIT_TXN_TYPES: TxnType[] = ["OPENING_CREDIT", "MANUAL_CREDIT", "REFUND"];

export const PENALTY_EVENTS = ["ABSENCE", "LATE", "LOSS", "WALKOVER", "CUSTOM"] as const;
export type PenaltyEvent = (typeof PENALTY_EVENTS)[number];

export const DEFAULT_PENALTY_RULES: { eventType: PenaltyEvent; label: string; amount: number; enabled: boolean }[] = [
  { eventType: "LOSS", label: "Match loss (lassi)", amount: 20, enabled: true },
  { eventType: "ABSENCE", label: "Absence fine", amount: 10, enabled: true },
  { eventType: "LATE", label: "Late arrival", amount: 10, enabled: true },
  { eventType: "WALKOVER", label: "Walkover given", amount: 30, enabled: true }
];

export const TOURNAMENT_FORMATS = ["KNOCKOUT"] as const;
export const TOURNAMENT_STATUSES = ["REGISTRATION", "ONGOING", "COMPLETED"] as const;
export const TOURNAMENT_SIZES = [4, 8, 16, 32] as const;

export const SKILL_LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "PROFESSIONAL"] as const;
export const PLAY_STYLES = ["ATTACKING_SMASH", "DEFENSIVE_CLEAR", "ALL_ROUND", "NET_PLAYER", "DECEPTIVE"] as const;
export const DOMINANT_HANDS = ["RIGHT", "LEFT"] as const;
export const TIME_PREFERENCES = ["MORNING", "AFTERNOON", "EVENING", "NIGHT"] as const;

export const NOTIFICATION_TYPES = {
  MATCH_CREATED: "MATCH_CREATED",
  MATCH_RESULT: "MATCH_RESULT",
  BOOKING_CONFIRMED: "BOOKING_CONFIRMED",
  BOOKING_CANCELLED: "BOOKING_CANCELLED",
  ATTENDANCE_REMINDER: "ATTENDANCE_REMINDER",
  PAYMENT_DUE: "PAYMENT_DUE",
  PENALTY_ADDED: "PENALTY_ADDED",
  TOURNAMENT_ANNOUNCED: "TOURNAMENT_ANNOUNCED",
  TOURNAMENT_RESULT: "TOURNAMENT_RESULT",
  MEMBERSHIP_APPROVED: "MEMBERSHIP_APPROVED",
  MEMBERSHIP_ROLE: "MEMBERSHIP_ROLE",
  WALLET_ADJUSTED: "WALLET_ADJUSTED",
  PLAN_CHANGED: "PLAN_CHANGED"
} as const;

export interface ClubSettings {
  sport: string;
  attendance: {
    startMinutes: number;
    graceMinutes: number;
    gpsRequired: boolean;
    gpsRadiusMeters: number;
    selfCheckIn: boolean;
    autoAbsentPenalty: boolean;
    minAttendancePct: number;
  };
  booking: { cancellationWindowMinutes: number };
  membership: { monthlyFee: number; autoApprove: boolean };
  matchmaking?: {
    allowAbsent: boolean;
  };
}

export const DEFAULT_CLUB_SETTINGS: ClubSettings = {
  sport: "BADMINTON",
  attendance: {
    startMinutes: 18 * 60,
    graceMinutes: 10,
    gpsRequired: false,
    gpsRadiusMeters: 300,
    selfCheckIn: true,
    autoAbsentPenalty: true,
    minAttendancePct: 60
  },
  booking: { cancellationWindowMinutes: 120 },
  membership: { monthlyFee: 0, autoApprove: true },
  matchmaking: {
    allowAbsent: false
  }
};

export function parseClubSettings(raw: string | null | undefined): ClubSettings {
  let parsed: any = {};
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch {
    parsed = {};
  }
  return {
    ...DEFAULT_CLUB_SETTINGS,
    ...parsed,
    attendance: { ...DEFAULT_CLUB_SETTINGS.attendance, ...(parsed.attendance ?? {}) },
    booking: { ...DEFAULT_CLUB_SETTINGS.booking, ...(parsed.booking ?? {}) },
    membership: { ...DEFAULT_CLUB_SETTINGS.membership, ...(parsed.membership ?? {}) },
    matchmaking: { ...DEFAULT_CLUB_SETTINGS.matchmaking, ...(parsed.matchmaking ?? {}) }
  };
}

export const SESSION_COOKIE = "bcos_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export const AUDIT_ACTIONS = {
  CLUB_UPDATED: "club.updated",
  SETTINGS_UPDATED: "club.settings_updated",
  PLAN_CHANGED: "platform.plan_changed",
  MEMBER_ADDED: "member.added",
  MEMBER_JOINED: "member.join_requested",
  MEMBER_APPROVED: "member.approved",
  MEMBER_BLOCKED: "member.blocked",
  MEMBER_REMOVED: "member.removed",
  ROLE_CHANGED: "member.role_changed",
  RULE_UPSERTED: "penalty.rule_upserted",
  RULE_DELETED: "penalty.rule_deleted",
  PENALTY_MANUAL: "penalty.manual_issue",
  PENALTY_REVERSED: "penalty.reversed",
  WALLET_ADJUSTED: "wallet.manual_adjustment",
  WALLET_REFUND: "wallet.refund",
  MATCH_EDITED: "match.edited",
  MATCH_CANCELLED: "match.cancelled",
  ATTENDANCE_MARKED: "attendance.marked",
  DAILY_SWEEP: "attendance.daily_sweep",
  COURT_UPDATED: "court.updated",
  TOURNAMENT_EVENT: "tournament.event"
} as const;

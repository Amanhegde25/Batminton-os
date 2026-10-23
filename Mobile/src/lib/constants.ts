export const APP_NAME = "Badminton Club OS";
export const SESSION_COOKIE = "bcos_session";

export const USER_ROLES = ["SUPER_ADMIN", "PLAYER"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const CLUB_ROLES = ["OWNER", "ADMIN", "COACH", "PLAYER"] as const;
export type ClubRole = (typeof CLUB_ROLES)[number];

export const GROUP_ROLES = ["LEADER", "ADMIN", "MEMBER"] as const;
export type GroupRole = (typeof GROUP_ROLES)[number];

export const COACHING_LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;
export type CoachingLevel = (typeof COACHING_LEVELS)[number];

export const COACHING_LEVEL_LABELS: Record<CoachingLevel, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced"
};

export const COACHING_LEVEL_DESCRIPTIONS: Record<CoachingLevel, string> = {
  BEGINNER: "Grip fundamentals, footwork basics & stroke technique",
  INTERMEDIATE: "Rally control, clears, drops, smashes & consistency",
  ADVANCED: "Match strategy, deception, speed & high-tempo tactics"
};

export const NOTIFICATION_TONES: Record<string, "primary" | "success" | "warning" | "danger" | "muted"> = {
  MATCH_CREATED: "primary",
  MATCH_RESULT: "success",
  BOOKING_CONFIRMED: "success",
  BOOKING_CANCELLED: "danger",
  ATTENDANCE_REMINDER: "warning",
  PAYMENT_DUE: "warning",
  PENALTY_ADDED: "danger",
  TOURNAMENT_ANNOUNCED: "primary",
  TOURNAMENT_RESULT: "success",
  MEMBERSHIP_APPROVED: "success",
  WALLET_ADJUSTED: "muted",
  PLAN_CHANGED: "muted"
};

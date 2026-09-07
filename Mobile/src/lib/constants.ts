export const APP_NAME = "Badminton Club OS";
export const SESSION_COOKIE = "bcos_session";

export const USER_ROLES = ["SUPER_ADMIN", "PLAYER"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const CLUB_ROLES = ["OWNER", "ADMIN", "COACH", "PLAYER"] as const;
export type ClubRole = (typeof CLUB_ROLES)[number];

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

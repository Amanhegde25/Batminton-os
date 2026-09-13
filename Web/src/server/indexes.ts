import { db } from "./db";

/**
 * Create all required indexes for the MongoDB collections.
 * Mirrors Prisma's @@unique and @@index annotations.
 * Safe to call multiple times — createIndex is idempotent.
 */
export async function ensureIndexes(): Promise<void> {
  // ── Users ──
  await db.collection("users").createIndex({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: "string" } } });
  await db.collection("users").createIndex({ mobile: 1 }, { unique: true, partialFilterExpression: { mobile: { $type: "string" } } });
  await db.collection("users").createIndex({ aadhar: 1 }, { unique: true, partialFilterExpression: { aadhar: { $type: "string" } } });
  await db.collection("users").createIndex({ googleId: 1 }, { unique: true, partialFilterExpression: { googleId: { $type: "string" } } });

  // ── PasswordResetTokens ──
  await db.collection("passwordResetTokens").createIndex({ tokenHash: 1 }, { unique: true });
  await db.collection("passwordResetTokens").createIndex({ userId: 1 });

  // ── OtpCodes ──
  await db.collection("otpCodes").createIndex({ mobile: 1, createdAt: 1 });

  // ── Clubs ──
  await db.collection("clubs").createIndex({ slug: 1 }, { unique: true });
  await db.collection("clubs").createIndex({ ownerId: 1 });

  // ── ClubMembers ──
  await db.collection("clubMembers").createIndex({ clubId: 1, userId: 1 }, { unique: true });
  await db.collection("clubMembers").createIndex({ userId: 1 });

  // ── Courts ──
  await db.collection("courts").createIndex({ clubId: 1, number: 1 }, { unique: true });
  await db.collection("courts").createIndex({ clubId: 1, status: 1 });

  // ── CourtBookings ──
  await db.collection("courtBookings").createIndex({ courtId: 1, startTime: 1 });
  await db.collection("courtBookings").createIndex({ clubId: 1, status: 1 });

  // ── AttendanceRecords ──
  await db.collection("attendanceRecords").createIndex({ clubId: 1, userId: 1, day: 1 }, { unique: true });
  await db.collection("attendanceRecords").createIndex({ clubId: 1, day: 1 });
  await db.collection("attendanceRecords").createIndex({ userId: 1, day: 1 });

  // ── Wallets ──
  await db.collection("wallets").createIndex({ clubId: 1, userId: 1 }, { unique: true });
  await db.collection("wallets").createIndex({ userId: 1 });

  await db.collection("walletTransactions").createIndex({ walletId: 1, createdAt: 1 });
  await db.collection("walletTransactions").createIndex({ clubId: 1, userId: 1, createdAt: 1 });
  await db.collection("walletTransactions").createIndex({ type: 1 });
  await db.collection("walletTransactions").createIndex({ reversesId: 1 }, { unique: true, partialFilterExpression: { reversesId: { $type: "string" } } });

  // ── PenaltyRules ──
  await db.collection("penaltyRules").createIndex({ clubId: 1, eventType: 1, label: 1 }, { unique: true });
  await db.collection("penaltyRules").createIndex({ clubId: 1, enabled: 1 });

  // ── Penalties ──
  await db.collection("penalties").createIndex({ clubId: 1, userId: 1, createdAt: 1 });
  await db.collection("penalties").createIndex({ clubId: 1, eventType: 1, createdAt: 1 });

  // ── Matches ──
  await db.collection("matches").createIndex({ clubId: 1, status: 1, scheduledAt: 1 });
  await db.collection("matches").createIndex({ tournamentId: 1 });

  // ── MatchTeams ──
  await db.collection("matchTeams").createIndex({ matchId: 1, teamIndex: 1 }, { unique: true });

  // ── MatchPlayers ──
  await db.collection("matchPlayers").createIndex({ matchId: 1, userId: 1 }, { unique: true });
  await db.collection("matchPlayers").createIndex({ userId: 1 });

  // ── MatchScores ──
  await db.collection("matchScores").createIndex({ matchId: 1, setNumber: 1 }, { unique: true });

  // ── PlayerRatings ──
  await db.collection("playerRatings").createIndex({ clubId: 1, userId: 1 }, { unique: true });
  await db.collection("playerRatings").createIndex({ clubId: 1, rating: 1 });

  // ── RatingHistories ──
  await db.collection("ratingHistories").createIndex({ clubId: 1, userId: 1, createdAt: 1 });
  await db.collection("ratingHistories").createIndex({ matchId: 1 });

  // ── Tournaments ──
  await db.collection("tournaments").createIndex({ clubId: 1, status: 1 });

  // ── TournamentParticipants ──
  await db.collection("tournamentParticipants").createIndex({ tournamentId: 1, userId: 1 }, { unique: true });

  // ── TournamentMatches ──
  await db.collection("tournamentMatches").createIndex({ tournamentId: 1, round: 1, slot: 1 }, { unique: true });
  await db.collection("tournamentMatches").createIndex({ tournamentId: 1, round: 1 });

  // ── Notifications ──
  await db.collection("notifications").createIndex({ userId: 1, readAt: 1, createdAt: 1 });

  // ── AIInsights ──
  await db.collection("aiInsights").createIndex({ userId: 1, kind: 1, createdAt: 1 });

  // ── VideoAnalyses ──
  await db.collection("videoAnalyses").createIndex({ userId: 1, createdAt: 1 });

  // ── AuditLogs ──
  await db.collection("auditLogs").createIndex({ clubId: 1, createdAt: 1 });
  await db.collection("auditLogs").createIndex({ action: 1 });

  // ── PlayGroups ──
  await db.collection("playGroups").createIndex({ slug: 1 }, { unique: true });
  await db.collection("playGroups").createIndex({ city: 1 });

  // ── PlayGroupMembers ──
  await db.collection("playGroupMembers").createIndex({ groupId: 1, userId: 1 }, { unique: true });
  await db.collection("playGroupMembers").createIndex({ userId: 1 });

  // ── PlayGroupSessions ──
  await db.collection("playGroupSessions").createIndex({ groupId: 1, scheduledDate: 1 });
  await db.collection("playGroupSessions").createIndex({ clubId: 1 });

  // ── PlayGroupSessionRsvps ──
  await db.collection("playGroupSessionRsvps").createIndex({ sessionId: 1, userId: 1 }, { unique: true });
  await db.collection("playGroupSessionRsvps").createIndex({ userId: 1 });

  // ── PlayGroupPosts ──
  await db.collection("playGroupPosts").createIndex({ groupId: 1, createdAt: 1 });

  console.log("✅ All MongoDB indexes ensured");
}

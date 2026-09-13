import { MongoClient, type Db, type Collection, type ClientSession } from "mongodb";

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/badminton-club-os";
const dbName = uri.split("/").pop()?.split("?")[0] || "badminton-club-os";

const globalForMongo = globalThis as unknown as { _mongoClient?: MongoClient; _mongoDb?: Db };

let client: MongoClient;
let database: Db;

if (globalForMongo._mongoClient && globalForMongo._mongoDb) {
  client = globalForMongo._mongoClient;
  database = globalForMongo._mongoDb;
} else {
  client = new MongoClient(uri);
  database = client.db(dbName);
  if (process.env.NODE_ENV !== "production") {
    globalForMongo._mongoClient = client;
    globalForMongo._mongoDb = database;
  }
}

export const mongoClient = client;
export const db = database;

/** Transaction type — MongoDB ClientSession for transactional ops, or null for non-transactional. */
export type Tx = Db | { db: Db; session: ClientSession };

export function col<T extends Document = any>(name: string): Collection<T> {
  return database.collection<T>(name);
}

// ── Typed collection accessors ──

export const users = () => col("users");
export const passwordResetTokens = () => col("passwordResetTokens");
export const otpCodes = () => col("otpCodes");
export const clubs = () => col("clubs");
export const clubMembers = () => col("clubMembers");
export const courts = () => col("courts");
export const courtBookings = () => col("courtBookings");
export const attendanceRecords = () => col("attendanceRecords");
export const wallets = () => col("wallets");
export const walletTransactions = () => col("walletTransactions");
export const penaltyRules = () => col("penaltyRules");
export const penalties = () => col("penalties");
export const matches = () => col("matches");
export const matchTeams = () => col("matchTeams");
export const matchPlayers = () => col("matchPlayers");
export const matchScores = () => col("matchScores");
export const playerRatings = () => col("playerRatings");
export const ratingHistories = () => col("ratingHistories");
export const tournaments = () => col("tournaments");
export const tournamentParticipants = () => col("tournamentParticipants");
export const tournamentMatches = () => col("tournamentMatches");
export const notifications = () => col("notifications");
export const aiInsights = () => col("aiInsights");
export const videoAnalyses = () => col("videoAnalyses");
export const auditLogs = () => col("auditLogs");
export const playGroups = () => col("playGroups");
export const playGroupMembers = () => col("playGroupMembers");
export const playGroupSessions = () => col("playGroupSessions");
export const playGroupSessionRsvps = () => col("playGroupSessionRsvps");
export const playGroupPosts = () => col("playGroupPosts");

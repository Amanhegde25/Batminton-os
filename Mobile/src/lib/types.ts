export interface SessionUser {
  id: string;
  email: string;
  mobile: string | null;
  name: string;
  photoUrl: string | null;
  role: string;
  tokenVersion: number;
  gender?: string | null;
  skillLevel?: string | null;
  playingStyle?: string | null;
  dominantHand?: string | null;
  preferredTime?: string | null;
}

export interface AuthSession {
  user: SessionUser;
  token?: string;
}

export interface MeClub {
  id: string;
  name: string;
  slug: string | null;
  logoUrl: string | null;
  subscriptionPlan: string;
  city: string | null;
}

export interface MeMembership {
  role: string;
  joinedAt: string;
  club: MeClub;
}

export interface Me extends SessionUser {
  memberships: MeMembership[];
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface NotificationsListResponse {
  items: NotificationItem[];
  unread: number;
}

// ----------------- Dashboard Types -----------------

export interface NearbyClub {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  address: string | null;
  logoUrl: string | null;
  description: string | null;
  subscriptionPlan: string;
  sport: string;
  courtCount: number;
  memberCount: number;
  lat: number | null;
  lng: number | null;
  distanceKm: number | null;
  membership?: { id: string; status: string; role: string } | null;
}

export interface PlayGroup {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  city: string | null;
  skillLevel: string;
  isPublic: boolean;
  logoUrl: string | null;
  createdAt: string;
  memberCount: number;
  totalSessions: number;
  myMembership?: { id: string; role: string; status: string } | null;
  nextSession?: {
    id: string;
    title: string;
    scheduledDate: string;
    clubName: string;
    maxPlayers: number;
    confirmedRsvps: number;
  } | null;
}

export interface PlayGroupSession {
  id: string;
  title: string;
  clubId: string | null;
  clubName: string;
  clubAddress: string | null;
  scheduledDate: string;
  durationMinutes: number;
  maxPlayers: number;
  costPerPlayer: number | null;
  notes: string | null;
  status: string;
  createdById: string;
  rsvps: {
    id: string;
    userId: string;
    status: string;
    user: { id: string; name: string; photoUrl: string | null };
  }[];
}

export interface RatingCard {
  rating: number;
  peak: number;
  wins: number;
  losses: number;
  winRate: number;
  monthlyDelta: number;
  consistency: number;
  trend: { label: string; value: number }[];
}

export interface TodayMatch {
  id: string;
  status: string;
  court?: { id: string; name: string; number: number } | null;
  scheduledAt: string;
  teams: { teamIndex: number; players: { id?: string; name: string }[] }[];
  scores?: { setNumber: number; a: number; b: number }[];
}

export interface AttendanceRecord {
  day: string;
  status: string;
}

export interface AdminStats {
  members: { total: number; pending: number };
  attendance: { presentToday: number };
  matches: { live: { id: string; label: string }[]; todayCount: number };
  courts: { total: number; available: number; maintenance: number };
  finance: {
    outstandingDues: number;
    membersInDues: number;
    revenueThisMonth: number;
    penaltiesThisWeek: number;
  };
  bookingsToday: number;
  recentActivity: { action: string; by: string; at: string; entityType: string }[];
}

// ----------------- Attendance Types -----------------

export interface AttendanceRosterRow {
  userId: string;
  name: string;
  photoUrl: string | null;
  status: string | null;
  method: string | null;
  checkInTime: string | null;
}

// ----------------- Match Types -----------------

export interface MatchRow {
  id: string;
  type: string;
  status: string;
  winnerTeamIndex: number | null;
  scheduledAt: string;
  court?: { id: string; name: string; number: number } | null;
  teams: { teamIndex: number; players: { id: string; name: string }[] }[];
  scores: { setNumber: number; a: number; b: number }[];
}

// ----------------- Court & Booking Types -----------------

export interface CourtItem {
  id: string;
  name: string;
  number: number;
  type: string;
  status: string;
  effectiveStatus?: string;
  occupancy?: { kind: string; label: string } | null;
  openHour: number;
  closeHour: number;
  hourlyFee: number;
}

export interface CourtBooking {
  id: string;
  courtId: string;
  court?: { id: string; name: string; number: number };
  startTime: string;
  endTime: string;
  status: string;
  feeAmount: number;
  notes: string | null;
  user?: { id: string; name: string; photoUrl: string | null };
}

// ----------------- Leaderboard Types -----------------

export interface LeaderboardEntry {
  userId: string;
  name: string;
  photoUrl: string | null;
  value: number;
  display: string;
  meta?: string;
}

// ----------------- Wallet Types -----------------

export interface WalletSummary {
  wallet: { id: string; balance: number; totalCredited: number; totalDebited: number } | null;
  pendingDues: number;
  monthCredit: number;
  monthDebit: number;
  monthNet: number;
}

export interface WalletTxn {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string | null;
  createdAt: string;
  status: string;
  user?: { id: string; name: string; photoUrl: string | null };
}

// ----------------- Matchmaking Types -----------------

export interface SidePlayer {
  id: string;
  name: string;
  rating: number;
}

export interface MatchmakingAssignment {
  court: { id: string; name: string; number: number } | null;
  teamA: SidePlayer[];
  teamB: SidePlayer[];
  explanation: {
    balancePct: number;
    ratingDiff: number;
    partnerRepetition: number;
    opponentRepetition: number;
  };
}

export interface MatchmakingPreview {
  assignments: MatchmakingAssignment[];
  queue: string[];
  summary: Record<string, unknown> & { reasonIfEmpty?: string };
  availablePlayers: number;
  availableCourts: number;
}

// ----------------- Tournament Types -----------------

export interface TournamentItem {
  id: string;
  name: string;
  size: number;
  status: string;
  fee: number;
  _count?: { participants: number };
}

// ----------------- Coaching Types -----------------

export interface CoachingInsight {
  headline: string;
  focusAreas: string[];
  drills: string[];
  summary: string;
  confidence: number;
  provider: string;
  generatedAt: string;
  cached: boolean;
}

// ----------------- Video Analysis Types -----------------

export interface VideoItem {
  id: string;
  fileName: string;
  status: string;
  durationSeconds: number | null;
  createdAt: string;
  userId?: string;
}

export interface VideoAnalysisResult {
  footworkScore: number;
  shotAccuracy: number;
  courtCoverage: number;
  smashSpeedKmh: number;
  rallyCount: number;
  insights: string[];
}

// ----------------- Member Types -----------------

export interface MemberItem {
  id: string;
  userId: string;
  name: string;
  email: string;
  photoUrl: string | null;
  role: string;
  status: string;
  rating: number;
  balance: number;
  attendanceRate: number;
  joinedAt: string;
}

// ----------------- Penalty Types -----------------

export interface PenaltyItem {
  id: string;
  userId: string;
  eventType: string;
  label: string | null;
  reason: string | null;
  amount: number;
  status: string;
  createdAt: string;
  user: { id: string; name: string; photoUrl: string | null };
}

export interface PenaltyRule {
  id: string;
  eventType: string;
  label: string;
  amount: number;
  enabled: boolean;
}

// ----------------- Club Settings Types -----------------

export interface ClubSettings {
  sport?: string;
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
}

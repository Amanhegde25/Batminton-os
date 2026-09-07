import type {
  ApiEnvelope,
  AuthSession,
  NotificationItem,
  NotificationsListResponse,
  SessionUser,
  Me,
  RatingCard,
  TodayMatch,
  AttendanceRecord,
  AdminStats,
  AttendanceRosterRow,
  MatchRow,
  CourtItem,
  CourtBooking,
  LeaderboardEntry,
  WalletSummary,
  WalletTxn,
  MatchmakingPreview,
  TournamentItem,
  CoachingInsight,
  VideoItem,
  MemberItem,
  PenaltyItem,
  PenaltyRule,
  ClubSettings
} from "./types";
import type { LoginInput } from "./schemas";

export interface ApiClientConfig {
  baseUrl: string;
  getToken?: () => Promise<string | null> | string | null;
  onUnauthorized?: () => void;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function createApiClient(config: ApiClientConfig) {
  async function request<T>(
    endpoint: string,
    options: RequestInit & { json?: unknown } = {}
  ): Promise<T> {
    const { json, headers: customHeaders, ...rest } = options;
    const cleanPath = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const url = `${config.baseUrl.replace(/\/$/, "")}${cleanPath}`;

    const headers: Record<string, string> = {
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...((customHeaders as Record<string, string>) ?? {})
    };

    if (config.getToken) {
      const token = await config.getToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }

    let res: Response;
    try {
      res = await fetch(url, {
        ...rest,
        headers,
        body: json !== undefined ? JSON.stringify(json) : rest.body
      });
    } catch (fetchErr) {
      console.warn(`[API] Network failure connecting to ${url}:`, fetchErr);
      throw new ApiError(
        0,
        "NETWORK_ERROR",
        `Cannot connect to server at ${config.baseUrl}. Check that the backend server is running and your device is on the same Wi-Fi.`
      );
    }

    if (res.status === 401 && config.onUnauthorized) {
      config.onUnauthorized();
    }

    const body = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;

    if (!res.ok || !body?.ok) {
      throw new ApiError(
        res.status,
        body?.error?.code ?? "HTTP_ERROR",
        body?.error?.message ?? `Request failed (${res.status})`,
        body?.error?.details
      );
    }

    return body.data as T;
  }

  return {
    request,

    // 1. Auth & Users
    auth: {
      login: (input: LoginInput) =>
        request<{ user: SessionUser; token?: string }>("/api/auth/login", {
          method: "POST",
          json: input
        }),
      token: () => request<{ user: SessionUser }>("/api/auth/token"),
      logout: () => request<void>("/api/auth/logout", { method: "POST" })
    },
    users: {
      me: () => request<Me>("/api/users/me"),
      updateProfile: (data: Partial<SessionUser>) =>
        request<SessionUser>("/api/users/me", { method: "PATCH", json: data })
    },

    // 2. Clubs & Dashboard
    clubs: {
      get: (clubId: string) =>
        request<{ id: string; name: string; settings: ClubSettings }>(`/api/clubs/${clubId}`),
      dashboard: (clubId: string) => request<AdminStats>(`/api/clubs/${clubId}/dashboard`),
      playerRating: (clubId: string, userId: string) =>
        request<RatingCard>(`/api/clubs/${clubId}/players/${userId}/rating`)
    },

    // 3. Attendance
    attendance: {
      today: (clubId: string, date?: string) => {
        const qs = date ? `?date=${date}` : "";
        return request<{
          rows?: AttendanceRosterRow[];
          roster?: {
            member: { userId: string; user: { name: string; photoUrl: string | null } };
            record: { status: string | null; method: string | null; createdAt: string } | null;
          }[];
        }>(`/api/clubs/${clubId}/attendance${qs}`);
      },
      history: (clubId: string, userId: string) =>
        request<AttendanceRecord[]>(`/api/clubs/${clubId}/attendance?view=history&userId=${userId}`),
      checkIn: (clubId: string, data: { status?: string; method?: string; code?: string }) =>
        request<{ success: boolean }>(`/api/clubs/${clubId}/attendance`, {
          method: "POST",
          json: data
        })
    },

    // 4. Matches
    matches: {
      list: (
        clubId: string,
        params?: { page?: number; pageSize?: number; status?: string; userId?: string; day?: string }
      ) => {
        const qs = new URLSearchParams();
        if (params?.page) qs.set("page", String(params.page));
        if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
        if (params?.status) qs.set("status", params.status);
        if (params?.userId) qs.set("userId", params.userId);
        if (params?.day) qs.set("day", params.day);
        return request<{ items: MatchRow[]; total: number; pageSize: number }>(
          `/api/clubs/${clubId}/matches?${qs.toString()}`
        );
      },
      create: (clubId: string, data: unknown) =>
        request<MatchRow>(`/api/clubs/${clubId}/matches`, { method: "POST", json: data })
    },

    // 5. Matchmaking
    matchmaking: {
      generate: (clubId: string, mode: "SINGLES" | "DOUBLES" = "DOUBLES") =>
        request<MatchmakingPreview>(`/api/clubs/${clubId}/matchmaking/generate?mode=${mode}`)
    },

    // 6. Courts & Bookings
    courts: {
      list: (clubId: string) => request<CourtItem[]>(`/api/clubs/${clubId}/courts`),
      bookings: (clubId: string, date: string) =>
        request<CourtBooking[]>(`/api/clubs/${clubId}/bookings?date=${date}`),
      book: (
        clubId: string,
        data: { courtId: string; startTime: string; endTime: string; notes?: string }
      ) =>
        request<CourtBooking>(`/api/clubs/${clubId}/bookings`, {
          method: "POST",
          json: data
        })
    },

    // 7. Leaderboards
    leaderboards: {
      get: (clubId: string, category = "HIGHEST_RATING", period = "ALL_TIME") =>
        request<{ entries: LeaderboardEntry[]; category: string; period: string }>(
          `/api/clubs/${clubId}/leaderboards?category=${category}&period=${period}`
        )
    },

    // 8. Wallet
    wallet: {
      summary: (clubId: string) => request<WalletSummary>(`/api/clubs/${clubId}/wallet`),
      transactions: (clubId: string, page = 1) =>
        request<{ items: WalletTxn[]; total: number; page: number; pageSize: number }>(
          `/api/clubs/${clubId}/wallet?view=txns&page=${page}`
        )
    },

    // 9. Tournaments
    tournaments: {
      list: (clubId: string) => request<TournamentItem[]>(`/api/clubs/${clubId}/tournaments`),
      create: (clubId: string, data: { name: string; size: number; fee: number }) =>
        request<TournamentItem>(`/api/clubs/${clubId}/tournaments`, {
          method: "POST",
          json: data
        })
    },

    // 10. Coaching
    coaching: {
      get: (clubId: string, userId?: string) =>
        request<CoachingInsight>(
          `/api/clubs/${clubId}/coaching${userId ? `?userId=${userId}` : ""}`
        )
    },

    // 11. Videos
    videos: {
      list: (clubId: string) => request<VideoItem[]>(`/api/clubs/${clubId}/videos`)
    },

    // 12. Members
    members: {
      list: (clubId: string, params?: { status?: string; q?: string }) => {
        const qs = new URLSearchParams();
        if (params?.status) qs.set("status", params.status);
        if (params?.q) qs.set("q", params.q);
        return request<MemberItem[]>(`/api/clubs/${clubId}/members?${qs.toString()}`);
      },
      create: (clubId: string, data: { name: string; email: string; role: string }) =>
        request<MemberItem>(`/api/clubs/${clubId}/members`, { method: "POST", json: data })
    },

    // 13. Penalties
    penalties: {
      list: (clubId: string) =>
        request<{ items: PenaltyItem[]; total: number }>(`/api/clubs/${clubId}/penalties`),
      rules: (clubId: string) => request<PenaltyRule[]>(`/api/clubs/${clubId}/penalties/rules`)
    },

    // 14. Notifications
    notifications: {
      list: (page = 1) =>
        request<NotificationsListResponse>(`/api/notifications?page=${page}`, {
          method: "GET"
        }),
      markRead: (ids?: string[]) =>
        request<{ marked: number }>("/api/notifications", {
          method: "POST",
          json: { ids }
        })
    }
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

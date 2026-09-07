import type {
  ApiEnvelope,
  AuthSession,
  NotificationItem,
  NotificationsListResponse,
  SessionUser
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

    const res = await fetch(url, {
      ...rest,
      headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
      credentials: "include"
    });

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
    auth: {
      login: (input: LoginInput) =>
        request<{ user: SessionUser; token?: string }>("/api/auth/login", {
          method: "POST",
          json: input
        }),
      me: () => request<{ user: SessionUser }>("/api/auth/token"),
      logout: () => request<void>("/api/auth/logout", { method: "POST" })
    },
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

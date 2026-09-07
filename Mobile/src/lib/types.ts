export interface SessionUser {
  id: string;
  email: string;
  mobile: string | null;
  name: string;
  photoUrl: string | null;
  role: string;
  tokenVersion: number;
}

export interface AuthSession {
  user: SessionUser;
  token?: string;
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

import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import type { SessionUser } from "./types";
import { SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/constants";
import { signToken, verifyToken } from "./tokens";
import { prisma } from "@/server/db";

interface CookiePayload {
  sub: string;
  tv: number;
  role?: string;
  typ?: string;
}

export function createSessionToken(user: { id: string; tokenVersion: number; role: string }): string {
  return signToken({ sub: user.id, tv: user.tokenVersion, role: user.role }, SESSION_TTL_SECONDS);
}

const isSecureCookie = () =>
  process.env.COOKIE_SECURE === "true" ||
  (process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false");

export function attachSession(res: NextResponse, user: { id: string; tokenVersion: number; role: string }): NextResponse {
  res.cookies.set(SESSION_COOKIE, createSessionToken(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureCookie(),
    path: "/",
    maxAge: SESSION_TTL_SECONDS
  });
  return res;
}

export function clearSession(res: NextResponse): NextResponse {
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureCookie(),
    path: "/",
    maxAge: 0
  });
  return res;
}

export async function currentUser(req?: Request): Promise<SessionUser | null> {
  let token: string | undefined;

  // 1. Check Authorization: Bearer <token> from explicit Request
  if (req) {
    const auth = req.headers.get("authorization");
    if (auth?.startsWith("Bearer ")) {
      token = auth.slice(7).trim();
    }
  }

  // 2. Check Authorization: Bearer <token> from next/headers
  if (!token) {
    try {
      const headerStore = await headers();
      const auth = headerStore.get("authorization");
      if (auth?.startsWith("Bearer ")) {
        token = auth.slice(7).trim();
      }
    } catch {
      // In contexts where headers() is unavailable
    }
  }

  // 3. Fallback to HTTP-only cookie
  if (!token) {
    try {
      const store = await cookies();
      token = store.get(SESSION_COOKIE)?.value;
    } catch {
      // In contexts where cookies() is unavailable
    }
  }

  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload || payload.typ) return null;
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || user.deletedAt) return null;
  if (user.tokenVersion !== (payload as CookiePayload).tv) return null;
  return {
    id: user.id,
    email: user.email,
    mobile: user.mobile,
    name: user.name,
    photoUrl: user.photoUrl,
    role: user.role,
    tokenVersion: user.tokenVersion
  };
}


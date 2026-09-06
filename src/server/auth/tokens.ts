import { env } from "@/lib/env";
import crypto from "node:crypto";

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function hmac(data: string): string {
  return crypto.createHmac("sha256", env.appSecret).update(data).digest("base64url");
}

export interface TokenPayload {
  sub: string;
  tv: number;
  role?: string;
  typ?: string;
  exp: number;
  [k: string]: unknown;
}

export type SignablePayload = Omit<TokenPayload, "exp">;

export function signToken(payload: SignablePayload, ttlSeconds = 60 * 60 * 24 * 7): string {
  const body: Record<string, unknown> = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify(body));
  const sig = hmac(`${header}.${claims}`);
  return `${header}.${claims}.${sig}`;
}

export function verifyToken(token: string): TokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, claims, sig] = parts;
  const expected = hmac(`${header}.${claims}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(claims, "base64url").toString()) as TokenPayload;
    if (!payload.exp || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

export function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

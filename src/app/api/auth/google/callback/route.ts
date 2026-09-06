import { NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { env } from "@/lib/env";
import { findOrCreateGoogleUser } from "@/server/services/users";
import { attachSession } from "@/server/auth/session";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    if (!env.googleEnabled || !code) {
      if (process.env.NODE_ENV !== "production" || !env.googleEnabled) {
        const user = await findOrCreateGoogleUser(
          "mock-google-id-12345",
          "google-demo@demo.club",
          "Demo Google User",
          undefined
        );
        return attachSession(NextResponse.redirect(new URL("/app", req.url)), user);
      }
      return NextResponse.redirect(new URL("/login?error=google_not_configured", req.url));
    }
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.googleClientId!,
        client_secret: env.googleClientSecret!,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/auth/google/callback`,
        grant_type: "authorization_code"
      })
    });
    if (!tokenRes.ok) throw new Error(`token exchange failed: ${tokenRes.status}`);
    const tokens = (await tokenRes.json()) as { access_token: string };
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    if (!profileRes.ok) throw new Error("profile fetch failed");
    const profile = (await profileRes.json()) as { id: string; email: string; name?: string; picture?: string };
    const user = await findOrCreateGoogleUser(profile.id, profile.email, profile.name ?? profile.email, profile.picture);
    return attachSession(NextResponse.redirect(new URL("/app", req.url)), user);
  } catch (e) {
    console.error("[auth/google] callback failed", e);
    void fail;
    return NextResponse.redirect(new URL("/login?error=google_failed", req.url));
  }
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { Button, Field, Input } from "@/components/ui";

function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2 text-lg font-bold">
          <span className="text-xl">🏸</span> Badminton Club OS
        </Link>
        <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </main>
  );
}

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"password" | "otp">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "password") {
        await api("/auth/login", { method: "POST", json: { email, password } });
      } else {
        await api("/auth/otp/verify", { method: "POST", json: { mobile, code } });
      }
      router.push("/app");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ expiresInSeconds: number; devCode?: string }>("/auth/otp/request", {
        method: "POST",
        json: { mobile }
      });
      setDevCode(res.devCode ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send OTP");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to manage your club or check your matches.">
      <form onSubmit={submit} className="space-y-4">
        {mode === "password" ? (
          <>
            <Field label="Email">
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@club.com" />
            </Field>
            <Field label="Password" error={error}>
              <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </Field>
          </>
        ) : (
          <>
            <Field label="Mobile number">
              <Input value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="+919876543210" />
            </Field>
            {devCode && (
              <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                Dev mode code: <b>{devCode}</b>
              </p>
            )}
            <Field label="OTP code" error={error}>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="6-digit code"
                inputMode="numeric"
                maxLength={6}
              />
            </Field>
          </>
        )}
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <div className="mt-4 space-y-2 text-center text-sm">
        {mode === "password" ? (
          <button type="button" className="text-primary hover:underline" onClick={() => setMode("otp")}>
            Sign in with phone OTP instead
          </button>
        ) : (
          <button type="button" className="text-primary hover:underline" onClick={() => setMode("password")}>
            Use email & password instead
          </button>
        )}
        <div>
          <Link href="/forgot" className="text-muted-foreground hover:text-foreground">
            Forgot password?
          </Link>
        </div>
        <p className="text-muted-foreground">
          New here?{" "}
          <Link href="/register" className="text-primary hover:underline">
            Create an account
          </Link>
        </p>
      </div>

      {mode === "password" && (
        <>
          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
          </div>
          <a
            href="/api/auth/google/callback"
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border bg-background text-sm font-medium shadow-sm hover:bg-muted"
          >
            <svg width="16" height="16" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.6 39.6 16.2 44 24 44z" />
              <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
            </svg>
            Continue with Google
          </a>
        </>
      )}
    </AuthShell>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", clubName: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/auth/register", { method: "POST", json: form });
      router.push("/app");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Create your account" subtitle="Register once — then create or join any number of clubs.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Full name">
          <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ravi Kumar" />
        </Field>
        <Field label="Email">
          <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@club.com" />
        </Field>
        <Field
          label="Password"
          hint="At least 8 characters with a letter and a number."
          error={error}
        >
          <Input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <Field label="Club name (optional)" hint="Leave empty to join an existing club later.">
          <Input
            value={form.clubName}
            onChange={(e) => setForm({ ...form, clubName: e.target.value })}
            placeholder="Smash Arena"
          />
        </Field>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Creating…" : "Create account"}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [resetPath, setResetPath] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ devResetPath?: string }>("/auth/forgot", { method: "POST", json: { email } });
      setSent(true);
      setResetPath(res.devResetPath ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Reset your password" subtitle="We'll send a reset link to your email address.">
      {sent ? (
        <div className="space-y-4 text-center">
          <p className="text-sm">If that email exists, a reset link is on its way.</p>
          {resetPath && (
            <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              Dev mode:{" "}
              <a href={resetPath} className="font-medium text-primary underline">
                open reset link
              </a>
            </p>
          )}
          <Link href="/login" className="block text-sm text-primary hover:underline">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email" error={error}>
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@club.com" />
          </Field>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Sending…" : "Send reset link"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            <Link href="/login" className="hover:text-foreground">
              Back to sign in
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}

export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api("/auth/reset", { method: "POST", json: { token, password } });
      router.push("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Choose a new password" subtitle="Pick something strong you don't use anywhere else.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="New password" error={error}>
          <Input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Confirm password">
          <Input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        <Button type="submit" disabled={busy || !token} className="w-full">
          {busy ? "Saving…" : token ? "Reset password" : "Invalid or missing token"}
        </Button>
      </form>
    </AuthShell>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { SessionProvider, useSession } from "@/components/session";
import { Button, Field, Input, Spinner } from "@/components/ui";
import { ShuttlecockIcon } from "@/components/icons";

function SetupContent() {
  const router = useRouter();
  const { me, loading, refresh } = useSession();

  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [aadhar, setAadhar] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!loading && me && !initialized) {
      if (me.email) setEmail(me.email);
      if (me.mobile) setMobile(me.mobile);
      if (me.aadhar) setAadhar(formatAadhar(me.aadhar));
      setInitialized(true);
    }
  }, [loading, me, initialized]);

  function formatAadhar(val: string): string {
    const digits = val.replace(/\D/g, "").slice(0, 12);
    const parts = [];
    for (let i = 0; i < digits.length; i += 4) {
      parts.push(digits.slice(i, i + 4));
    }
    return parts.join(" ");
  }

  function handleAadharChange(e: React.ChangeEvent<HTMLInputElement>) {
    setAadhar(formatAadhar(e.target.value));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const cleanAadhar = aadhar.replace(/\D/g, "");
    if (cleanAadhar && cleanAadhar.length !== 12) {
      setError("Aadhaar number must be exactly 12 digits.");
      setBusy(false);
      return;
    }

    try {
      await api("/users/setup", {
        method: "POST",
        json: {
          email: email.trim() || undefined,
          mobile: mobile.trim() || undefined,
          aadhar: cleanAadhar || undefined,
          skip: false
        }
      });
      await refresh();
      router.push("/app");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile setup");
    } finally {
      setBusy(false);
    }
  }

  async function handleSkip() {
    setBusy(true);
    setError(null);
    try {
      await api("/users/setup", {
        method: "POST",
        json: { skip: true }
      });
      await refresh();
      router.push("/app");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to skip setup");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Spinner />
      </main>
    );
  }

  if (!me) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center justify-center gap-2 text-lg font-bold">
            <ShuttlecockIcon className="h-6 w-6 text-primary" /> Badminton Club OS
          </div>
          <div className="rounded-2xl border bg-card p-6 text-center shadow-sm sm:p-8">
            <h1 className="text-xl font-semibold">Profile Setup</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Please sign in or create an account to view and complete your setup.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <Link href="/login">
                <Button className="w-full">Sign in</Button>
              </Link>
              <Link href="/register">
                <Button variant="outline" className="w-full">Create account</Button>
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const needsEmail = !me.email;
  const needsMobile = !me.mobile;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2 text-lg font-bold">
          <ShuttlecockIcon className="h-6 w-6 text-primary" /> Badminton Club OS
        </div>

        <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          <div className="mb-6">
            <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              Step 2 of 2: Profile Setup
            </span>
            <h1 className="mt-2 text-xl font-semibold">Welcome, {me.name}!</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {needsEmail && !needsMobile
                ? "You registered with your mobile number. You can optionally link an email and your Aadhaar number below."
                : !needsEmail && needsMobile
                ? "You registered with your email. You can optionally link your mobile and Aadhaar number below."
                : "You can optionally link contact details and your Aadhaar number below."}
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm font-medium text-destructive">
              {error}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            {/* Show linked identifier info */}
            {!needsEmail && (
              <Field label="Email address (Linked)">
                <Input
                  type="email"
                  value={email}
                  disabled
                  className="bg-muted text-muted-foreground cursor-not-allowed"
                />
              </Field>
            )}

            {!needsMobile && (
              <Field label="Mobile number (Linked)">
                <Input
                  type="tel"
                  value={mobile}
                  disabled
                  className="bg-muted text-muted-foreground cursor-not-allowed"
                />
              </Field>
            )}

            {/* If registered with mobile or email is missing, ask for email */}
            {needsEmail && (
              <Field
                label="Email address (Optional)"
                hint="Link an email for password recovery and tournament notifications."
              >
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@club.com"
                />
              </Field>
            )}

            {/* If registered with email or mobile is missing, ask for mobile */}
            {needsMobile && (
              <Field
                label="Mobile number (Optional)"
                hint="Add your phone number for instant match alerts and OTP sign-in."
              >
                <Input
                  type="tel"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="+91 98765 43210"
                />
              </Field>
            )}

            {/* Aadhaar number */}
            <Field
              label="Aadhaar number (Optional)"
              hint="12-digit Indian UIDAI ID. Stored securely and must be unique."
            >
              <Input
                type="text"
                value={aadhar}
                onChange={handleAadharChange}
                placeholder="XXXX XXXX XXXX"
                maxLength={14}
                inputMode="numeric"
              />
            </Field>

            <div className="pt-2 space-y-3">
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? "Saving…" : "Save & Continue"}
              </Button>

              <button
                type="button"
                disabled={busy}
                onClick={handleSkip}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                Skip for now →
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}

export default function SetupPage() {
  return (
    <SessionProvider>
      <SetupContent />
    </SessionProvider>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "@/components/session";
import { api } from "@/lib/client";
import { Avatar, Badge, Button, Card, Field, Input, Select, Spinner, Tabs, useToast } from "@/components/ui";
import {
  Shield,
  Sun,
  Moon,
  Bell,
  ArrowRight,
  Building2,
  Lock,
  Sliders,
  CheckCircle2
} from "@/components/icons";

function formatAadhar(val: string): string {
  const digits = val.replace(/\D/g, "").slice(0, 12);
  const parts = [];
  for (let i = 0; i < digits.length; i += 4) {
    parts.push(digits.slice(i, i + 4));
  }
  return parts.join(" ");
}

export default function SettingsPage() {
  const router = useRouter();
  const { me, activeMembership, refresh } = useSession();
  const [tab, setTab] = useState("profile");
  const [savingProfile, setSavingProfile] = useState(false);
  const [aadhar, setAadhar] = useState("");
  const [initializedAadhar, setInitializedAadhar] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [changingPw, setChangingPw] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const { toast, node } = useToast();

  const isStaff = ["OWNER", "ADMIN"].includes(activeMembership?.role ?? "") || me?.role === "SUPER_ADMIN";

  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/login");
    router.refresh();
  }

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  useEffect(() => {
    if (me?.aadhar && !initializedAadhar) {
      setAadhar(formatAadhar(me.aadhar));
      setInitializedAadhar(true);
    }
  }, [me?.aadhar, initializedAadhar]);

  function toggleTheme(nextDark: boolean) {
    setIsDark(nextDark);
    document.documentElement.classList.toggle("dark", nextDark);
    try {
      localStorage.setItem("bcos-theme", nextDark ? "dark" : "light");
    } catch {}
    toast(`Theme set to ${nextDark ? "Dark" : "Light"} mode`);
  }

  async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavingProfile(true);
    const f = new FormData(e.currentTarget);
    const rawAadhar = aadhar.replace(/\D/g, "");
    if (rawAadhar && rawAadhar.length !== 12) {
      setSavingProfile(false);
      return toast("Aadhaar number must be exactly 12 digits", "error");
    }

    const emailVal = (f.get("email") as string)?.trim() || "";
    const mobileVal = (f.get("mobile") as string)?.trim() || "";

    if (!emailVal && !mobileVal) {
      setSavingProfile(false);
      return toast("You must keep at least one contact method (email or mobile number)", "error");
    }

    try {
      await api("/users/me", {
        method: "PATCH",
        json: {
          name: f.get("name"),
          email: emailVal ? emailVal : null,
          mobile: mobileVal ? mobileVal : null,
          aadhar: rawAadhar ? rawAadhar : null,
          gender: f.get("gender") || undefined,
          skillLevel: f.get("skillLevel") || undefined,
          playingStyle: f.get("playingStyle") || undefined,
          dominantHand: f.get("dominantHand") || undefined,
          preferredTime: f.get("preferredTime") || undefined,
          showMatchStats: f.get("showMatchStats") === "on"
        }
      });
      await refresh();
      toast("Profile saved successfully");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed", "error");
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!pw.next) return toast("New password cannot be empty", "error");
    if (pw.next.length < 8) return toast("Password must be at least 8 characters", "error");
    if (pw.next !== pw.confirm) return toast("Passwords don't match", "error");

    setChangingPw(true);
    try {
      await api("/auth/change-password", {
        method: "POST",
        json: { currentPassword: pw.current || null, newPassword: pw.next }
      });
      toast("Password changed successfully — other sessions revoked");
      setPw({ current: "", next: "", confirm: "" });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Change failed", "error");
    } finally {
      setChangingPw(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {node}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Personal & App Settings</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage your personal profile, playing traits, account credentials, and interface preferences.
          </p>
        </div>
      </div>

      {/* Staff Callout to Club Admin Settings */}
      {isStaff && (
        <Card className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-primary/5 border-primary/20">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-foreground flex items-center gap-2">
                <span>Looking for Club Settings?</span>
                <Badge tone="primary" className="text-[10px]">
                  {activeMembership?.role || "STAFF"}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Club description, opening/closing hours, GPS geofencing, and rules are located in the Club Admin panel.
              </p>
            </div>
          </div>
          <Link href="/app/admin/settings" className="shrink-0">
            <Button size="sm" className="gap-1.5 text-xs w-full sm:w-auto">
              Open Club Settings <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </Card>
      )}

      <Tabs
        tabs={[
          { key: "profile", label: "My Profile" },
          { key: "security", label: "Security" },
          { key: "preferences", label: "App Preferences" }
        ]}
        active={tab}
        onChange={setTab}
      />

      {/* Tab: Profile */}
      {tab === "profile" && me && (
        <div className="space-y-6">
          <Card className="flex items-center gap-4 p-5">
            <Avatar name={me.name} src={me.photoUrl} size={56} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold truncate">{me.name}</h2>
                <Badge tone="accent">{me.role}</Badge>
              </div>
              <p className="text-sm text-muted-foreground truncate">
                {me.email || me.mobile || "No contact info linked"}
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {me.email ? (
                  <Badge tone="primary">Email linked</Badge>
                ) : (
                  <Badge tone="muted">No email</Badge>
                )}
                {me.mobile ? (
                  <Badge tone="primary">Mobile linked</Badge>
                ) : null}
                {me.aadhar ? (
                  <Badge tone="success">Aadhaar verified</Badge>
                ) : (
                  <Badge tone="muted">Aadhaar not set</Badge>
                )}
              </div>
            </div>
          </Card>

          <form onSubmit={saveProfile} className="space-y-6 rounded-xl border bg-card p-5 sm:p-6">
            <div>
              <h3 className="text-base font-semibold">Account & Contact Details</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                You only need either an email or mobile number linked. Aadhaar is optional.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Full name">
                  <Input name="name" defaultValue={me.name} required />
                </Field>

                <Field
                  label="Email address"
                  hint={me.email ? "Linked. You can remove your phone number if you keep this email." : "Optional if mobile number is provided."}
                >
                  <Input
                    name="email"
                    type="email"
                    defaultValue={me.email ?? ""}
                    placeholder="you@club.com"
                  />
                </Field>

                <Field
                  label="Mobile number"
                  hint={me.mobile ? "Linked. You can remove your email if you keep this phone number." : "Optional if email address is provided."}
                >
                  <Input
                    name="mobile"
                    type="tel"
                    defaultValue={me.mobile ?? ""}
                    placeholder="+91 98765 43210"
                  />
                </Field>

                <Field
                  label="Aadhaar number (Optional)"
                  hint="Not required. Stored securely if provided for tournament identity."
                >
                  <Input
                    name="aadhar"
                    value={aadhar}
                    onChange={(e) => setAadhar(formatAadhar(e.target.value))}
                    placeholder="XXXX XXXX XXXX"
                    maxLength={14}
                    inputMode="numeric"
                  />
                </Field>
              </div>
            </div>

            <hr className="border-border/60" />

            <div>
              <h3 className="text-base font-semibold">Player & Badminton Preferences</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Used by AI matchmaking and court coordinators to place you in fair games.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Gender">
                  <Select name="gender" defaultValue={me.gender ?? ""}>
                    <option value="">—</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </Select>
                </Field>

                <Field label="Skill level">
                  <Select name="skillLevel" defaultValue={me.skillLevel ?? ""}>
                    <option value="">—</option>
                    {["BEGINNER", "INTERMEDIATE", "ADVANCED", "PRO"].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </Select>
                </Field>

                <Field label="Playing style">
                  <Select name="playingStyle" defaultValue={me.playingStyle ?? ""}>
                    <option value="">—</option>
                    {["ATTACKING", "DEFENSIVE", "ALL_ROUNDER"].map((s) => (
                      <option key={s} value={s}>{s.replace("_", "-")}</option>
                    ))}
                  </Select>
                </Field>

                <Field label="Dominant hand">
                  <Select name="dominantHand" defaultValue={me.dominantHand ?? ""}>
                    <option value="">—</option>
                    <option value="RIGHT">Right</option>
                    <option value="LEFT">Left</option>
                  </Select>
                </Field>

                <Field label="Preferred time">
                  <Select name="preferredTime" defaultValue={me.preferredTime ?? ""}>
                    <option value="">—</option>
                    <option value="MORNING">Morning</option>
                    <option value="EVENING">Evening</option>
                  </Select>
                </Field>
              </div>
            </div>

            <hr className="border-border/60" />

            <div>
              <h3 className="text-base font-semibold">Privacy & Match Statistics</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Control whether fellow club members can view your win and loss records.
              </p>
              <div className="mt-4 rounded-xl border border-border/80 bg-background/50 p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="showMatchStats"
                    defaultChecked={me.showMatchStats !== false}
                    className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <div>
                    <span className="text-sm font-medium text-foreground">
                      Show wins & losses in Club Members Directory
                    </span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      When enabled, other club members can see your club and lifetime match record. Turn off to keep your stats private.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button type="submit" disabled={savingProfile} className="gap-1.5 text-xs">
                {savingProfile ? <Spinner className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                {savingProfile ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Tab: Security */}
      {tab === "security" && (
        <Card className="max-w-md p-5 sm:p-6 space-y-5">
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" /> Update Password
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Change your login password. All other active browser sessions will be revoked.
            </p>
          </div>

          <form onSubmit={changePassword} className="space-y-4">
            <Field label="Current password" hint="Leave empty if you signed up without a password.">
              <Input
                type="password"
                value={pw.current}
                onChange={(e) => setPw({ ...pw, current: e.target.value })}
                placeholder="Current password"
              />
            </Field>

            <Field label="New password" hint="Must be at least 8 characters">
              <Input
                type="password"
                minLength={8}
                value={pw.next}
                onChange={(e) => setPw({ ...pw, next: e.target.value })}
                placeholder="New password"
                required
              />
            </Field>

            <Field label="Confirm new password">
              <Input
                type="password"
                value={pw.confirm}
                onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
                placeholder="Confirm new password"
                required
              />
            </Field>

            <Button type="submit" disabled={changingPw} className="w-full gap-1.5 text-xs">
              {changingPw ? <Spinner className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
              {changingPw ? "Updating…" : "Update Password"}
            </Button>
          </form>
        </Card>
      )}

      {/* Tab: App Preferences */}
      {tab === "preferences" && (
        <div className="space-y-5 max-w-xl">
          {/* Theme card */}
          <Card className="p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Sliders className="h-4 w-4 text-primary" /> Interface Appearance
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Choose your preferred visual theme for Badminton Club OS.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => toggleTheme(false)}
                className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
                  !isDark
                    ? "border-primary bg-primary/10 shadow-sm"
                    : "border-border/60 hover:border-primary/40 hover:bg-muted/30"
                }`}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-background text-foreground shadow-xs">
                  <Sun className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold">Light Mode</div>
                  <div className="text-[10px] text-muted-foreground">Crisp clean styling</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => toggleTheme(true)}
                className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
                  isDark
                    ? "border-primary bg-primary/10 shadow-sm"
                    : "border-border/60 hover:border-primary/40 hover:bg-muted/30"
                }`}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-background text-foreground shadow-xs">
                  <Moon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold">Dark Mode</div>
                  <div className="text-[10px] text-muted-foreground">OLED dark cockpit</div>
                </div>
              </button>
            </div>
          </Card>

          {/* Quick Notification Link */}
          <Card className="p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Bell className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold">Notifications & Alerts</h4>
                <p className="text-[11px] text-muted-foreground">
                  View your activity notifications, game invites, and club alerts.
                </p>
              </div>
            </div>
            <Link href="/app/notifications">
              <Button variant="outline" size="sm" className="gap-1 text-xs">
                View <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </Card>

          {/* Session Overview */}
          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-semibold">Current Session</h4>
                <p className="font-mono text-[11px] text-muted-foreground mt-0.5">
                  Signed in as {me?.email || me?.mobile || me?.name} ({me?.role})
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={logout} className="text-xs text-destructive hover:bg-destructive/10">
                Sign out
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

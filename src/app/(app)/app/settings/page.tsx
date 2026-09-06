"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/session";
import { api } from "@/lib/client";
import { Badge, Button, Card, Field, Input, Select, Spinner } from "@/components/ui";
import { Table, Tabs, Td, useToast } from "@/components/ui";

interface ClubSettings {
  attendance: { startMinutes: number; graceMinutes: number; requireQr: boolean; requireGps: boolean };
  booking: { minMinutes: number; maxHoursPerDay: number; cancellationWindowHours: number; hourlyFee: number };
  membership: { requireApproval: boolean; allowSelfRegistration: boolean };
}

function SettingsInner() {
  const { me, activeClubId, activeMembership, refresh } = useSession();
  const [tab, setTab] = useState("profile");
  const [settings, setSettings] = useState<ClubSettings | null>(null);
  const [audit, setAudit] = useState<{ id: string; action: string; actor?: { name: string; email: string } | null; createdAt: string }[]>([]);
  const [savingSettings, setSavingSettings] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const { toast, node } = useToast();

  const isStaff = ["OWNER", "ADMIN"].includes(activeMembership?.role ?? "");

  const loadClub = useCallback(async () => {
    if (!activeClubId || !isStaff) return;
    try {
      const club = await api<{ id: string; name: string; settings: ClubSettings }>(`/clubs/${activeClubId}`);
      setSettings(club.settings);
    } catch {}
  }, [activeClubId, isStaff]);

  useEffect(() => {
    void loadClub();
    if (tab === "audit" && isStaff && activeClubId) {
      void api<{ items: typeof audit }>(`/clubs/${activeClubId}/audit`)
        .then((d) => setAudit(d.items))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClubId, tab, isStaff]);

  async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await api("/users/me", {
        method: "PATCH",
        json: {
          name: f.get("name"),
          mobile: f.get("mobile") || null,
          gender: f.get("gender") || undefined,
          skillLevel: f.get("skillLevel") || undefined,
          playingStyle: f.get("playingStyle") || undefined,
          dominantHand: f.get("dominantHand") || undefined,
          preferredTime: f.get("preferredTime") || undefined
        }
      });
      await refresh();
      toast("Profile saved");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed", "error");
    }
  }

  async function changePassword() {
    if (pw.next !== pw.confirm) return toast("Passwords don't match", "error");
    try {
      await api("/auth/change-password", { method: "POST", json: { currentPassword: pw.current || null, newPassword: pw.next } });
      toast("Password changed — other sessions revoked");
      setPw({ current: "", next: "", confirm: "" });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Change failed", "error");
    }
  }

  async function saveSettings() {
    if (!settings) return;
    setSavingSettings(true);
    try {
      await api(`/clubs/${activeClubId}`, { method: "PATCH", json: { settings } });
      toast("Club settings saved");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed", "error");
    } finally {
      setSavingSettings(false);
    }
  }

  function num(v: string) {
    return Number(v) || 0;
  }

  return (
    <div className="space-y-4">
      {node}
      <h1 className="text-2xl font-bold">Settings</h1>
      <Tabs
        tabs={[
          { key: "profile", label: "My profile" },
          { key: "security", label: "Security" },
          ...(isStaff ? [{ key: "club", label: "Club" }] : []),
          ...(isStaff ? [{ key: "audit", label: "Audit log" }] : [])
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "profile" && me && (
        <form onSubmit={saveProfile} className="grid max-w-2xl gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2">
          <Field label="Full name">
            <Input name="name" defaultValue={me.name} required />
          </Field>
          <Field label="Mobile">
            <Input name="mobile" defaultValue={me.mobile ?? ""} placeholder="+91…" />
          </Field>
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
                <option key={s}>{s}</option>
              ))}
            </Select>
          </Field>
          <Field label="Playing style">
            <Select name="playingStyle" defaultValue={me.playingStyle ?? ""}>
              <option value="">—</option>
              {["ATTACKING", "DEFENSIVE", "ALL_ROUNDER"].map((s) => (
                <option key={s}>{s.replace("_", "-")}</option>
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
          <div className="flex items-end">
            <Button type="submit">Save profile</Button>
          </div>
        </form>
      )}

      {tab === "security" && (
        <Card className="max-w-md space-y-4 p-5">
          <Field label="Current password" hint="Leave empty if you signed up without a password.">
            <Input type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
          </Field>
          <Field label="New password">
            <Input type="password" minLength={8} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
          </Field>
          <Field label="Confirm new password">
            <Input type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
          </Field>
          <Button onClick={changePassword}>Change password</Button>
        </Card>
      )}

      {isStaff && tab === "club" && settings && (
        <div className="max-w-3xl space-y-4">
          <Card className="space-y-5 p-5">
            <p className="font-semibold">Attendance rules</p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Field label="Opens at (min past midnight)">
                <Input
                  type="number"
                  value={settings.attendance.startMinutes}
                  onChange={(e) => setSettings({ ...settings, attendance: { ...settings.attendance, startMinutes: num(e.target.value) } })}
                />
              </Field>
              <Field label="Grace minutes">
                <Input
                  type="number"
                  value={settings.attendance.graceMinutes}
                  onChange={(e) => setSettings({ ...settings, attendance: { ...settings.attendance, graceMinutes: num(e.target.value) } })}
                />
              </Field>
              <label className="flex items-end gap-2 pb-2 text-sm">
                <input
                  type="checkbox"
                  checked={settings.attendance.requireQr}
                  onChange={(e) => setSettings({ ...settings, attendance: { ...settings.attendance, requireQr: e.target.checked } })}
                />
                Require QR
              </label>
              <label className="flex items-end gap-2 pb-2 text-sm">
                <input
                  type="checkbox"
                  checked={settings.attendance.requireGps}
                  onChange={(e) => setSettings({ ...settings, attendance: { ...settings.attendance, requireGps: e.target.checked } })}
                />
                Require GPS
              </label>
            </div>

            <p className="font-semibold">Bookings</p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Field label="Min slot (min)">
                <Input
                  type="number"
                  value={settings.booking.minMinutes}
                  onChange={(e) => setSettings({ ...settings, booking: { ...settings.booking, minMinutes: num(e.target.value) } })}
                />
              </Field>
              <Field label="Max hours/day">
                <Input
                  type="number"
                  value={settings.booking.maxHoursPerDay}
                  onChange={(e) => setSettings({ ...settings, booking: { ...settings.booking, maxHoursPerDay: num(e.target.value) } })}
                />
              </Field>
              <Field label="Free cancel window (h)">
                <Input
                  type="number"
                  value={settings.booking.cancellationWindowHours}
                  onChange={(e) =>
                    setSettings({ ...settings, booking: { ...settings.booking, cancellationWindowHours: num(e.target.value) } })
                  }
                />
              </Field>
              <Field label="Default fee ₹/hr">
                <Input
                  type="number"
                  value={Math.round(settings.booking.hourlyFee / 100)}
                  onChange={(e) => setSettings({ ...settings, booking: { ...settings.booking, hourlyFee: num(e.target.value) * 100 } })}
                />
              </Field>
            </div>

            <p className="font-semibold">Membership</p>
            <div className="flex gap-6 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.membership.requireApproval}
                  onChange={(e) =>
                    setSettings({ ...settings, membership: { ...settings.membership, requireApproval: e.target.checked } })
                  }
                />
                Require approval to join
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.membership.allowSelfRegistration}
                  onChange={(e) =>
                    setSettings({ ...settings, membership: { ...settings.membership, allowSelfRegistration: e.target.checked } })
                  }
                />
                Allow self registration
              </label>
            </div>

            <Button onClick={saveSettings} disabled={savingSettings}>
              {savingSettings ? "Saving…" : "Save club settings"}
            </Button>
          </Card>
        </div>
      )}

      {isStaff && tab === "audit" && (
        <Table head={["Action", "Actor", "When"]}>
          {audit.map((a) => (
            <tr key={a.id} className="border-b last:border-0">
              <Td>
                <Badge>{a.action}</Badge>
              </Td>
              <Td>{a.actor?.name ?? "—"}</Td>
              <Td className="text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleString()}</Td>
            </tr>
          ))}
          {audit.length === 0 && (
            <tr>
              <Td colSpan={3} className="py-10 text-center text-muted-foreground">
                No audit entries yet.
              </Td>
            </tr>
          )}
        </Table>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return <SettingsInner />;
}

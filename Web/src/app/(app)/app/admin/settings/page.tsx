"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/session";
import { api } from "@/lib/client";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  Select,
  Spinner,
  Table,
  Tabs,
  Td,
  useToast
} from "@/components/ui";
import {
  Building2,
  Clock,
  Compass,
  MapPin,
  RefreshCw,
  Sliders,
  Shield,
  CheckCircle2,
  FileText
} from "@/components/icons";
import { SPORTS, DEFAULT_CLUB_SETTINGS, type ClubSettings } from "@/lib/constants";

interface ClubDetailsResponse {
  id: string;
  name: string;
  slug: string;
  description?: string;
  city?: string;
  address?: string;
  logoUrl?: string;
  lat?: number;
  lng?: number;
  isPublic?: boolean;
  settings: ClubSettings;
}

interface AuditLogItem {
  id: string;
  action: string;
  actor?: { name: string; email: string } | null;
  createdAt: string;
}

export default function ClubAdminSettingsPage() {
  const { activeClubId, refresh } = useSession();
  const [tab, setTab] = useState("profile");
  const [loadingClub, setLoadingClub] = useState(true);
  const [saving, setSaving] = useState(false);
  const [detectingGps, setDetectingGps] = useState(false);
  const { toast, node } = useToast();

  // Club details state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [lat, setLat] = useState<number | undefined>(undefined);
  const [lng, setLng] = useState<number | undefined>(undefined);

  // Club settings state
  const [settings, setSettings] = useState<ClubSettings>(DEFAULT_CLUB_SETTINGS);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const loadClub = useCallback(async () => {
    if (!activeClubId) return;
    setLoadingClub(true);
    try {
      const data = await api<ClubDetailsResponse>(`/clubs/${activeClubId}`);
      setName(data.name || "");
      setDescription(data.description || "");
      setCity(data.city || "");
      setAddress(data.address || "");
      setIsPublic(data.isPublic ?? true);
      setLat(data.lat);
      setLng(data.lng);
      setSettings({
        ...DEFAULT_CLUB_SETTINGS,
        ...(data.settings || {}),
        openingTime: data.settings?.openingTime || DEFAULT_CLUB_SETTINGS.openingTime,
        closingTime: data.settings?.closingTime || DEFAULT_CLUB_SETTINGS.closingTime,
        scheduleNotes: data.settings?.scheduleNotes || DEFAULT_CLUB_SETTINGS.scheduleNotes,
        attendance: {
          ...DEFAULT_CLUB_SETTINGS.attendance,
          ...(data.settings?.attendance || {})
        },
        booking: {
          ...DEFAULT_CLUB_SETTINGS.booking,
          ...(data.settings?.booking || {})
        },
        membership: {
          ...DEFAULT_CLUB_SETTINGS.membership,
          ...(data.settings?.membership || {})
        },
        matchmaking: {
          allowAbsent: Boolean(data.settings?.matchmaking?.allowAbsent ?? false)
        }
      });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to load club details", "error");
    } finally {
      setLoadingClub(false);
    }
  }, [activeClubId]);

  const loadAudit = useCallback(async () => {
    if (!activeClubId) return;
    setLoadingAudit(true);
    try {
      const res = await api<{ items: AuditLogItem[] }>(`/clubs/${activeClubId}/audit`);
      setAuditLogs(res.items || []);
    } catch {
      setAuditLogs([]);
    } finally {
      setLoadingAudit(false);
    }
  }, [activeClubId]);

  useEffect(() => {
    void loadClub();
  }, [loadClub]);

  useEffect(() => {
    if (tab === "audit") {
      void loadAudit();
    }
  }, [tab, loadAudit]);

  function detectLocation() {
    if (!navigator.geolocation) {
      return toast("Geolocation is not supported by your browser", "error");
    }
    setDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(Number(pos.coords.latitude.toFixed(6)));
        setLng(Number(pos.coords.longitude.toFixed(6)));
        setDetectingGps(false);
        toast("GPS coordinates detected from device");
      },
      (err) => {
        setDetectingGps(false);
        toast(`Location detection failed: ${err.message}`, "error");
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }

  async function handleSave(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!activeClubId) return;

    if (!name.trim()) {
      return toast("Club name cannot be empty", "error");
    }

    setSaving(true);
    try {
      await api(`/clubs/${activeClubId}`, {
        method: "PATCH",
        json: {
          name: name.trim(),
          description: description.trim(),
          city: city.trim() || undefined,
          address: address.trim() || undefined,
          isPublic,
          lat: lat !== undefined && !isNaN(lat) ? lat : undefined,
          lng: lng !== undefined && !isNaN(lng) ? lng : undefined,
          settings
        }
      });
      await refresh();
      toast("Club profile and settings saved successfully");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to update club", "error");
    } finally {
      setSaving(false);
    }
  }

  const num = (v: string) => Number(v) || 0;

  if (loadingClub) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {node}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" /> Club Profile & Configuration
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure club description, opening and closing hours, geofence, and club attendance policies.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadClub} disabled={saving} className="gap-1.5 text-xs">
            <RefreshCw className="h-3.5 w-3.5" /> Reload
          </Button>
          <Button size="sm" onClick={() => void handleSave()} disabled={saving} className="gap-1.5 text-xs">
            {saving ? <Spinner className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </div>

      <Tabs
        tabs={[
          { key: "profile", label: "Profile & Identity" },
          { key: "schedule", label: "Hours & Location" },
          { key: "policies", label: "Rules & Policies" },
          { key: "audit", label: "Audit Logs" }
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "profile" && (
        <form onSubmit={handleSave} className="space-y-5">
          <Card className="p-5 sm:p-6 space-y-5">
            <div className="border-b border-border/50 pb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                <Building2 className="h-4 w-4 text-primary" /> Club Identity
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Public presentation and information visible to players and visitors.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Club Name" hint="Official facility name">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Smash Zone Arena"
                  required
                />
              </Field>

              <Field label="Primary Sport" hint="Default sport for court bookings & rules">
                <Select
                  value={settings.sport || "BADMINTON"}
                  onChange={(e) => setSettings({ ...settings, sport: e.target.value })}
                >
                  {SPORTS.map((s) => (
                    <option key={s} value={s}>
                      {s.charAt(0) + s.slice(1).toLowerCase()}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field
              label="Club Description / About"
              hint={`Visible on club discovery cards and profile page. (${description.length}/500)`}
            >
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 500))}
                rows={3}
                placeholder="Tell players about your facility, courts, lighting, amenities, and community vibe…"
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="City / Region" hint="e.g. Bengaluru, Mumbai, Delhi">
                <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Bengaluru"
                />
              </Field>

              <Field label="Physical Street Address" hint="Full address with landmark">
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. 45 Outer Ring Rd, Marathahalli"
                />
              </Field>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <div>
                  <span className="text-xs font-semibold text-foreground">
                    List club publicly in nearby venue discovery
                  </span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    When enabled, local players can discover your facility, view operating hours, and request membership.
                  </p>
                </div>
              </label>
            </div>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={saving} className="gap-1.5 text-xs">
              {saving ? <Spinner className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {saving ? "Saving…" : "Save Profile"}
            </Button>
          </div>
        </form>
      )}

      {tab === "schedule" && (
        <form onSubmit={handleSave} className="space-y-5">
          {/* Operating Hours Card */}
          <Card className="p-5 sm:p-6 space-y-5">
            <div className="border-b border-border/50 pb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                <Clock className="h-4 w-4 text-primary" /> Operating Hours & Schedule
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Set daily opening and closing hours and public schedule notes for members and visitors.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Opening Time"
                hint="Daily opening time (e.g. 06:00)"
              >
                <Input
                  type="time"
                  value={settings.openingTime || "06:00"}
                  onChange={(e) => setSettings({ ...settings, openingTime: e.target.value })}
                />
              </Field>

              <Field
                label="Closing Time"
                hint="Daily closing time (e.g. 22:00)"
              >
                <Input
                  type="time"
                  value={settings.closingTime || "22:00"}
                  onChange={(e) => setSettings({ ...settings, closingTime: e.target.value })}
                />
              </Field>
            </div>

            <Field
              label="Operating Schedule Notes"
              hint="Shown on public club card and bookings page"
            >
              <Input
                value={settings.scheduleNotes || ""}
                onChange={(e) => setSettings({ ...settings, scheduleNotes: e.target.value })}
                placeholder="e.g. Open daily: 6:00 AM – 10:00 PM • Lighted courts until 10 PM"
              />
            </Field>

            <div className="border-t border-border/50 pt-4">
              <Field
                label="Check-in Session Start Offset (Minutes past midnight)"
                hint="Used for attendance verification sweep (e.g. 360 = 6:00 AM, 1080 = 6:00 PM)"
              >
                <Input
                  type="number"
                  min={0}
                  max={1439}
                  value={settings.attendance.startMinutes}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      attendance: { ...settings.attendance, startMinutes: num(e.target.value) }
                    })
                  }
                />
              </Field>
            </div>
          </Card>

          {/* GPS Geofencing Card */}
          <Card className="p-5 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-3">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <MapPin className="h-4 w-4 text-primary" /> GPS Geofencing & Location
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Pinpoint your facility coordinates so members can verify presence via GPS check-in.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={detectLocation}
                disabled={detectingGps}
                className="gap-1.5 text-xs shrink-0"
              >
                {detectingGps ? <Spinner className="h-3 w-3" /> : <Compass className="h-3.5 w-3.5 text-primary" />}
                {detectingGps ? "Detecting…" : "Detect Device GPS"}
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Latitude" hint="e.g. 12.953847">
                <Input
                  type="number"
                  step="any"
                  value={lat !== undefined ? lat : ""}
                  onChange={(e) => setLat(e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="12.953847"
                />
              </Field>

              <Field label="Longitude" hint="e.g. 77.697583">
                <Input
                  type="number"
                  step="any"
                  value={lng !== undefined ? lng : ""}
                  onChange={(e) => setLng(e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="77.697583"
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="GPS Geofence Radius (meters)" hint="Allowed distance from venue for valid check-in">
                <Input
                  type="number"
                  min={20}
                  max={5000}
                  value={settings.attendance.gpsRadiusMeters}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      attendance: { ...settings.attendance, gpsRadiusMeters: num(e.target.value) }
                    })
                  }
                />
              </Field>

              <div className="flex items-center pt-6">
                <label className="flex items-center gap-2.5 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={settings.attendance.gpsRequired}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        attendance: { ...settings.attendance, gpsRequired: e.target.checked }
                      })
                    }
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="font-medium text-foreground">
                    Enforce strict GPS match for attendance check-ins
                  </span>
                </label>
              </div>
            </div>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={saving} className="gap-1.5 text-xs">
              {saving ? <Spinner className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {saving ? "Saving…" : "Save Schedule & Geofence"}
            </Button>
          </div>
        </form>
      )}

      {tab === "policies" && (
        <form onSubmit={handleSave} className="space-y-5">
          {/* Attendance Policies */}
          <Card className="p-5 sm:p-6 space-y-5">
            <div className="border-b border-border/50 pb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                <Sliders className="h-4 w-4 text-primary" /> Attendance & Session Rules
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Grace periods and penalties for attendance logging.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Check-in Grace Period (minutes)" hint="Allowed arrival buffer after session start">
                <Input
                  type="number"
                  min={0}
                  max={120}
                  value={settings.attendance.graceMinutes}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      attendance: { ...settings.attendance, graceMinutes: num(e.target.value) }
                    })
                  }
                />
              </Field>

              <Field label="Minimum Attendance Target (%)" hint="Recommended attendance threshold for active members">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={settings.attendance.minAttendancePct}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      attendance: { ...settings.attendance, minAttendancePct: num(e.target.value) }
                    })
                  }
                />
              </Field>
            </div>

            <div className="space-y-3 pt-2">
              <label className="flex items-center gap-2.5 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={settings.attendance.selfCheckIn}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      attendance: { ...settings.attendance, selfCheckIn: e.target.checked }
                    })
                  }
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <span className="font-medium text-foreground">
                  Allow player self check-in via mobile QR / geolocation
                </span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={settings.attendance.autoAbsentPenalty}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      attendance: { ...settings.attendance, autoAbsentPenalty: e.target.checked }
                    })
                  }
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <span className="font-medium text-foreground">
                  Automatically levy penalty on absentees during nightly attendance sweep
                </span>
              </label>
            </div>
          </Card>

          {/* Bookings & Membership */}
          <Card className="p-5 sm:p-6 space-y-5">
            <div className="border-b border-border/50 pb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                <Shield className="h-4 w-4 text-primary" /> Bookings & Membership Dues
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Cancellation policy and monthly club dues.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Court Booking Free Cancellation Window (minutes)" hint="e.g. 120 = 2 hours before start">
                <Input
                  type="number"
                  min={0}
                  max={1440}
                  value={settings.booking.cancellationWindowMinutes}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      booking: { ...settings.booking, cancellationWindowMinutes: num(e.target.value) }
                    })
                  }
                />
              </Field>

              <Field label="Monthly Membership Fee (₹)" hint="Standard recurring club dues">
                <Input
                  type="number"
                  min={0}
                  value={Math.round((settings.membership.monthlyFee || 0) / 100)}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      membership: { ...settings.membership, monthlyFee: num(e.target.value) * 100 }
                    })
                  }
                />
              </Field>
            </div>

            <div className="space-y-3 pt-2">
              <label className="flex items-center gap-2.5 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={settings.membership.autoApprove}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      membership: { ...settings.membership, autoApprove: e.target.checked }
                    })
                  }
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <span className="font-medium text-foreground">
                  Auto-approve new member join requests without manual admin review
                </span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={settings.matchmaking?.allowAbsent ?? false}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      matchmaking: { ...(settings.matchmaking ?? {}), allowAbsent: e.target.checked }
                    })
                  }
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <span className="font-medium text-foreground">
                  Allow absent/unverified players into AI matchmaking queues
                </span>
              </label>
            </div>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={saving} className="gap-1.5 text-xs">
              {saving ? <Spinner className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {saving ? "Saving…" : "Save Policies"}
            </Button>
          </div>
        </form>
      )}

      {tab === "audit" && (
        <Card className="p-0 overflow-hidden">
          <div className="p-4 border-b border-border/50 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                <FileText className="h-4 w-4 text-primary" /> Club Activity Audit Log
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Chronological record of modifications made by owners and administrators.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={loadAudit} disabled={loadingAudit} className="h-7 text-xs gap-1.5">
              <RefreshCw className="h-3 w-3" /> Refresh
            </Button>
          </div>

          {loadingAudit ? (
            <div className="py-12 flex justify-center">
              <Spinner className="h-6 w-6 text-primary" />
            </div>
          ) : (
            <Table head={["Action", "Actor", "Timestamp"]}>
              {auditLogs.map((log) => (
                <tr key={log.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <Td>
                    <Badge tone="muted" className="font-mono text-[10px]">
                      {log.action}
                    </Badge>
                  </Td>
                  <Td className="text-xs font-medium">
                    {log.actor?.name || log.actor?.email || "System"}
                  </Td>
                  <Td className="text-xs text-muted-foreground font-mono">
                    {new Date(log.createdAt).toLocaleString()}
                  </Td>
                </tr>
              ))}
              {auditLogs.length === 0 && (
                <tr>
                  <Td colSpan={3} className="py-12 text-center text-xs text-muted-foreground">
                    No administrative audit records found for this club.
                  </Td>
                </tr>
              )}
            </Table>
          )}
        </Card>
      )}
    </div>
  );
}

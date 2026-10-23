"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/session";
import { api } from "@/lib/client";
import {
  Badge,
  Button,
  Card,
  Dialog,
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
  Award,
  Calendar,
  Clock,
  Plus,
  RefreshCw,
  Trash,
  CheckCircle2,
  X,
  Users
} from "@/components/icons";
import { DAYS_OF_WEEK, DEFAULT_COACHING_SLOTS, COACHING_LEVELS, COACHING_LEVEL_LABELS, type DayOfWeek, type CoachingLevel } from "@/lib/constants";

interface CoachItem {
  id: string;
  name: string;
  title: string | null;
  bio: string | null;
  phone: string | null;
  email: string | null;
  photoUrl: string | null;
  hourlyFee: number;
  pricing: {
    BEGINNER: number;
    INTERMEDIATE: number;
    ADVANCED: number;
  };
  levels: CoachingLevel[];
  availableDays: string[];
  availableTimeSlots: string[];
  active: boolean;
  createdAt: string;
}

interface CoachingBookingItem {
  id: string;
  coachId: string;
  coachName: string;
  userId: string;
  userName: string;
  userEmail: string;
  sessionDate: string;
  dayOfWeek: string;
  timeSlot: string;
  level: CoachingLevel;
  notes: string | null;
  fee: number;
  status: "CONFIRMED" | "COMPLETED" | "CANCELLED";
  createdAt: string;
}

export default function ClubAdminCoachingPage() {
  const { activeClubId } = useSession();
  const [tab, setTab] = useState("coaches");
  const [coachesList, setCoachesList] = useState<CoachItem[]>([]);
  const [bookingsList, setBookingsList] = useState<CoachingBookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const { toast, node } = useToast();

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCoach, setEditingCoach] = useState<CoachItem | null>(null);
  const [savingCoach, setSavingCoach] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formBio, setFormBio] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formFeeBeginner, setFormFeeBeginner] = useState("400");
  const [formFeeIntermediate, setFormFeeIntermediate] = useState("600");
  const [formFeeAdvanced, setFormFeeAdvanced] = useState("850");
  const [formLevels, setFormLevels] = useState<CoachingLevel[]>([...COACHING_LEVELS]);
  const [formDays, setFormDays] = useState<string[]>([...DAYS_OF_WEEK]);
  const [formSlots, setFormSlots] = useState<string[]>([
    "06:00 - 07:00",
    "07:00 - 08:00",
    "17:00 - 18:00",
    "18:00 - 19:00",
    "19:00 - 20:00"
  ]);
  const [customSlotInput, setCustomSlotInput] = useState("");
  const [formActive, setFormActive] = useState(true);

  const loadData = useCallback(async () => {
    if (!activeClubId) return;
    setLoading(true);
    try {
      const [coachesRes, bookingsRes] = await Promise.all([
        api<{ items: CoachItem[] }>(`/clubs/${activeClubId}/coaches`),
        api<{ items: CoachingBookingItem[] }>(`/clubs/${activeClubId}/coaches/bookings`)
      ]);
      setCoachesList(coachesRes.items || []);
      setBookingsList(bookingsRes.items || []);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to load coaching data", "error");
    } finally {
      setLoading(false);
    }
  }, [activeClubId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function openCreateModal() {
    setEditingCoach(null);
    setFormName("");
    setFormTitle("");
    setFormBio("");
    setFormPhone("");
    setFormEmail("");
    setFormFeeBeginner("400");
    setFormFeeIntermediate("600");
    setFormFeeAdvanced("850");
    setFormLevels([...COACHING_LEVELS]);
    setFormDays([...DAYS_OF_WEEK]);
    setFormSlots([
      "06:00 - 07:00",
      "07:00 - 08:00",
      "17:00 - 18:00",
      "18:00 - 19:00",
      "19:00 - 20:00"
    ]);
    setFormActive(true);
    setModalOpen(true);
  }

  function openEditModal(c: CoachItem) {
    setEditingCoach(c);
    setFormName(c.name);
    setFormTitle(c.title || "");
    setFormBio(c.bio || "");
    setFormPhone(c.phone || "");
    setFormEmail(c.email || "");
    const bFee = c.pricing?.BEGINNER ? Math.round(c.pricing.BEGINNER / 100) : Math.round(c.hourlyFee / 100);
    const iFee = c.pricing?.INTERMEDIATE ? Math.round(c.pricing.INTERMEDIATE / 100) : Math.round((c.hourlyFee * 1.25) / 100);
    const aFee = c.pricing?.ADVANCED ? Math.round(c.pricing.ADVANCED / 100) : Math.round((c.hourlyFee * 1.6) / 100);
    setFormFeeBeginner(String(bFee || 400));
    setFormFeeIntermediate(String(iFee || 600));
    setFormFeeAdvanced(String(aFee || 850));
    setFormLevels(Array.isArray(c.levels) && c.levels.length > 0 ? c.levels : [...COACHING_LEVELS]);
    setFormDays(c.availableDays || [...DAYS_OF_WEEK]);
    setFormSlots(c.availableTimeSlots || [...DEFAULT_COACHING_SLOTS]);
    setFormActive(c.active);
    setModalOpen(true);
  }

  function toggleLevel(level: CoachingLevel) {
    if (formLevels.includes(level)) {
      if (formLevels.length === 1) {
        return toast("Coach must offer at least one coaching level", "error");
      }
      setFormLevels(formLevels.filter((lvl) => lvl !== level));
    } else {
      setFormLevels([...formLevels, level]);
    }
  }

  function toggleDay(day: string) {
    if (formDays.includes(day)) {
      if (formDays.length === 1) {
        return toast("At least one available day is required", "error");
      }
      setFormDays(formDays.filter((d) => d !== day));
    } else {
      setFormDays([...formDays, day]);
    }
  }

  function toggleSlot(slot: string) {
    if (formSlots.includes(slot)) {
      if (formSlots.length === 1) {
        return toast("At least one time slot is required", "error");
      }
      setFormSlots(formSlots.filter((s) => s !== slot));
    } else {
      setFormSlots([...formSlots, slot]);
    }
  }

  function addCustomSlot() {
    const trimmed = customSlotInput.trim();
    if (!trimmed) return;
    if (formSlots.includes(trimmed)) {
      return toast("Slot already added", "error");
    }
    setFormSlots([...formSlots, trimmed]);
    setCustomSlotInput("");
  }

  async function handleSaveCoach(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim()) return toast("Coach name is required", "error");
    if (formLevels.length === 0) return toast("Select at least one coaching level", "error");
    if (formDays.length === 0) return toast("Select at least one day", "error");
    if (formSlots.length === 0) return toast("Select at least one time slot", "error");

    setSavingCoach(true);
    try {
      const bFeePaise = (Math.max(0, Number(formFeeBeginner)) || 0) * 100;
      const iFeePaise = (Math.max(0, Number(formFeeIntermediate)) || 0) * 100;
      const aFeePaise = (Math.max(0, Number(formFeeAdvanced)) || 0) * 100;

      const payload = {
        name: formName.trim(),
        title: formTitle.trim() || undefined,
        bio: formBio.trim() || undefined,
        phone: formPhone.trim() || undefined,
        email: formEmail.trim() || undefined,
        hourlyFee: bFeePaise,
        pricing: {
          BEGINNER: bFeePaise,
          INTERMEDIATE: iFeePaise,
          ADVANCED: aFeePaise
        },
        levels: formLevels,
        availableDays: formDays,
        availableTimeSlots: formSlots,
        ...(editingCoach ? { active: formActive } : {})
      };

      if (editingCoach) {
        await api(`/clubs/${activeClubId}/coaches/${editingCoach.id}`, {
          method: "PATCH",
          json: payload
        });
        toast("Coach profile and level rates updated");
      } else {
        await api(`/clubs/${activeClubId}/coaches`, {
          method: "POST",
          json: payload
        });
        toast("New coach added to club roster with custom level pricing");
      }
      setModalOpen(false);
      void loadData();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save coach", "error");
    } finally {
      setSavingCoach(false);
    }
  }

  async function handleDeleteCoach(coach: CoachItem) {
    if (!confirm(`Are you sure you want to remove ${coach.name} from club coaches?`)) return;
    try {
      await api(`/clubs/${activeClubId}/coaches/${coach.id}`, { method: "DELETE" });
      toast(`${coach.name} removed from roster`);
      void loadData();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Delete failed", "error");
    }
  }

  async function updateBookingStatus(bookingId: string, status: "COMPLETED" | "CANCELLED") {
    try {
      await api(`/clubs/${activeClubId}/coaches/bookings/${bookingId}`, {
        method: "PATCH",
        json: { status }
      });
      toast(`Booking marked as ${status.toLowerCase()}`);
      void loadData();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Action failed", "error");
    }
  }

  const filteredBookings = bookingsList.filter((b) => {
    if (statusFilter === "ALL") return true;
    return b.status === statusFilter;
  });

  return (
    <div className="space-y-6 max-w-5xl">
      {node}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" /> Coaches & Training System
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Add club coaches, specify weekly available days and hours, and monitor player coaching bookings.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="gap-1.5 text-xs">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Reload
          </Button>
          <Button size="sm" onClick={openCreateModal} className="gap-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" /> Add New Coach
          </Button>
        </div>
      </div>

      <Tabs
        tabs={[
          { key: "coaches", label: `Club Coaches (${coachesList.length})` },
          { key: "bookings", label: `Session Bookings (${bookingsList.length})` }
        ]}
        active={tab}
        onChange={setTab}
      />

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner className="h-8 w-8 text-primary" />
        </div>
      ) : tab === "coaches" ? (
        <div className="space-y-4">
          {coachesList.length === 0 ? (
            <Card className="p-12 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Award className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold">No Coaches Added Yet</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Add coaches to your badminton facility so club players can discover their schedules and book 1-on-1 or group coaching sessions.
              </p>
              <Button size="sm" onClick={openCreateModal} className="gap-1.5 mt-2">
                <Plus className="h-4 w-4" /> Add First Coach
              </Button>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {coachesList.map((coach) => (
                <Card key={coach.id} className="p-5 flex flex-col justify-between space-y-4 hover:border-primary/40 transition-colors">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-base font-bold text-foreground flex items-center gap-1.5">
                          {coach.name}
                        </h4>
                        {coach.title && (
                          <p className="text-xs font-medium text-primary mt-0.5">{coach.title}</p>
                        )}
                      </div>
                      <Badge tone={coach.active ? "success" : "muted"} className="text-[10px]">
                        {coach.active ? "Active" : "Inactive"}
                      </Badge>
                    </div>

                    {coach.bio && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{coach.bio}</p>
                    )}

                    <div className="rounded-xl bg-muted/40 p-3 space-y-2.5 border border-border/50 text-xs">
                      <div>
                        <span className="text-[11px] text-muted-foreground font-semibold flex items-center justify-between mb-1.5">
                          <span>Level Pricing (Admin Configured):</span>
                        </span>
                        <div className="grid grid-cols-3 gap-1.5 text-center">
                          <div className={`p-1.5 rounded-lg border ${coach.levels?.includes("BEGINNER") ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300" : "opacity-40 bg-muted/30 border-dashed"}`}>
                            <div className="text-[10px] font-bold">Beginner</div>
                            <div className="font-mono text-xs font-bold mt-0.5">
                              ₹{Math.round((coach.pricing?.BEGINNER ?? coach.hourlyFee) / 100)}
                            </div>
                          </div>
                          <div className={`p-1.5 rounded-lg border ${coach.levels?.includes("INTERMEDIATE") ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300" : "opacity-40 bg-muted/30 border-dashed"}`}>
                            <div className="text-[10px] font-bold">Intermediate</div>
                            <div className="font-mono text-xs font-bold mt-0.5">
                              ₹{Math.round((coach.pricing?.INTERMEDIATE ?? coach.hourlyFee * 1.25) / 100)}
                            </div>
                          </div>
                          <div className={`p-1.5 rounded-lg border ${coach.levels?.includes("ADVANCED") ? "bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-300" : "opacity-40 bg-muted/30 border-dashed"}`}>
                            <div className="text-[10px] font-bold">Advanced</div>
                            <div className="font-mono text-xs font-bold mt-0.5">
                              ₹{Math.round((coach.pricing?.ADVANCED ?? coach.hourlyFee * 1.6) / 100)}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-primary" /> Available Days:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {coach.availableDays.map((d) => (
                            <span
                              key={d}
                              className="rounded px-1.5 py-0.5 text-[9px] font-mono font-semibold uppercase bg-primary/10 text-primary"
                            >
                              {d.slice(0, 3)}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1 pt-1">
                        <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                          <Clock className="h-3 w-3 text-primary" /> Available Timings:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {coach.availableTimeSlots.map((s) => (
                            <span
                              key={s}
                              className="rounded px-1.5 py-0.5 text-[10px] font-mono bg-background text-foreground border border-border/60"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between border-t border-border/40">
                    <Button variant="ghost" size="sm" onClick={() => openEditModal(coach)} className="h-8 text-xs">
                      Edit Coach
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleDeleteCoach(coach)}
                      className="h-8 text-xs text-destructive hover:bg-destructive/10"
                    >
                      <Trash className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Session Bookings Tab */
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">Filter by status:</span>
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-8 text-xs w-36">
                <option value="ALL">All Statuses</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </Select>
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              Showing {filteredBookings.length} bookings
            </span>
          </div>

          <Card className="p-0 overflow-hidden">
            <Table head={["Member", "Coach & Level", "Date & Day", "Time Slot", "Fee", "Status", "Actions"]}>
              {filteredBookings.map((b) => (
                <tr key={b.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <Td>
                    <div>
                      <div className="font-semibold text-xs text-foreground">{b.userName}</div>
                      <div className="text-[11px] font-mono text-muted-foreground">{b.userEmail}</div>
                      {b.notes && (
                        <div className="text-[11px] text-muted-foreground italic mt-0.5 max-w-xs truncate">
                          "{b.notes}"
                        </div>
                      )}
                    </div>
                  </Td>
                  <Td>
                    <div className="space-y-1">
                      <span className="font-semibold text-xs text-foreground flex items-center gap-1">
                        <Award className="h-3.5 w-3.5 text-primary" /> {b.coachName}
                      </span>
                      <Badge
                        tone={
                          b.level === "BEGINNER"
                            ? "primary"
                            : b.level === "INTERMEDIATE"
                            ? "warning"
                            : "accent"
                        }
                        className="text-[9px]"
                      >
                        {COACHING_LEVEL_LABELS[b.level] || b.level} Level
                      </Badge>
                    </div>
                  </Td>
                  <Td className="text-xs">
                    <div className="font-medium">{b.sessionDate}</div>
                    <div className="text-[10px] uppercase font-mono text-muted-foreground">{b.dayOfWeek}</div>
                  </Td>
                  <Td className="text-xs font-mono font-medium">{b.timeSlot}</Td>
                  <Td className="text-xs font-semibold">₹{Math.round(b.fee / 100)}</Td>
                  <Td>
                    <Badge
                      tone={
                        b.status === "CONFIRMED"
                          ? "accent"
                          : b.status === "COMPLETED"
                          ? "success"
                          : "danger"
                      }
                      className="text-[10px]"
                    >
                      {b.status}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      {b.status === "CONFIRMED" && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[11px] text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                            onClick={() => void updateBookingStatus(b.id, "COMPLETED")}
                          >
                            Complete
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-[11px] text-destructive hover:bg-destructive/10"
                            onClick={() => void updateBookingStatus(b.id, "CANCELLED")}
                          >
                            Cancel
                          </Button>
                        </>
                      )}
                      {b.status !== "CONFIRMED" && (
                        <span className="text-xs text-muted-foreground font-mono">—</span>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
              {filteredBookings.length === 0 && (
                <tr>
                  <Td colSpan={7} className="py-12 text-center text-xs text-muted-foreground">
                    No coaching session bookings found.
                  </Td>
                </tr>
              )}
            </Table>
          </Card>
        </div>
      )}

      {/* Add / Edit Coach Modal */}
      <Dialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingCoach ? "Edit Coach Details" : "Add Coach to Club Roster"}
      >
        <form onSubmit={handleSaveCoach} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          <Field label="Full Name" hint="Coach's official name">
            <Input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Ramesh Padukone"
              required
            />
          </Field>

          <Field label="Designation / Title" hint="e.g. Senior Badminton Coach • BWF Level 2">
            <Input
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="e.g. Head Coach • BWF Certified"
            />
          </Field>

          {/* Coaching Levels & Custom Cost Configuration */}
          <div className="space-y-2.5 pt-1 border-t border-border/50">
            <div>
              <label className="text-xs font-semibold text-foreground">Coaching Levels & Rates (₹/hr)</label>
              <p className="text-[11px] text-muted-foreground">
                Set individual pricing for each skill level and choose which levels this coach is available to teach:
              </p>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-3">
              {/* Beginner */}
              <div
                className={`rounded-xl border p-3 transition-all ${
                  formLevels.includes("BEGINNER")
                    ? "border-emerald-500/40 bg-emerald-500/5 shadow-xs"
                    : "border-border/60 bg-muted/20 opacity-60"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Beginner</span>
                  <input
                    type="checkbox"
                    checked={formLevels.includes("BEGINNER")}
                    onChange={() => toggleLevel("BEGINNER")}
                    className="h-4 w-4 rounded text-primary border-border focus:ring-primary cursor-pointer"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground font-medium">Session Fee (₹/hr)</label>
                  <Input
                    type="number"
                    min={0}
                    value={formFeeBeginner}
                    disabled={!formLevels.includes("BEGINNER")}
                    onChange={(e) => setFormFeeBeginner(e.target.value)}
                    placeholder="400"
                    className="h-8 text-xs font-mono"
                    required={formLevels.includes("BEGINNER")}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5 leading-tight">
                  Grip fundamentals, footwork basics & initial drills
                </p>
              </div>

              {/* Intermediate */}
              <div
                className={`rounded-xl border p-3 transition-all ${
                  formLevels.includes("INTERMEDIATE")
                    ? "border-amber-500/40 bg-amber-500/5 shadow-xs"
                    : "border-border/60 bg-muted/20 opacity-60"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400">Intermediate</span>
                  <input
                    type="checkbox"
                    checked={formLevels.includes("INTERMEDIATE")}
                    onChange={() => toggleLevel("INTERMEDIATE")}
                    className="h-4 w-4 rounded text-primary border-border focus:ring-primary cursor-pointer"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground font-medium">Session Fee (₹/hr)</label>
                  <Input
                    type="number"
                    min={0}
                    value={formFeeIntermediate}
                    disabled={!formLevels.includes("INTERMEDIATE")}
                    onChange={(e) => setFormFeeIntermediate(e.target.value)}
                    placeholder="600"
                    className="h-8 text-xs font-mono"
                    required={formLevels.includes("INTERMEDIATE")}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5 leading-tight">
                  Rallies, drop shots, smashes & consistency
                </p>
              </div>

              {/* Advanced */}
              <div
                className={`rounded-xl border p-3 transition-all ${
                  formLevels.includes("ADVANCED")
                    ? "border-purple-500/40 bg-purple-500/5 shadow-xs"
                    : "border-border/60 bg-muted/20 opacity-60"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-purple-600 dark:text-purple-400">Advanced</span>
                  <input
                    type="checkbox"
                    checked={formLevels.includes("ADVANCED")}
                    onChange={() => toggleLevel("ADVANCED")}
                    className="h-4 w-4 rounded text-primary border-border focus:ring-primary cursor-pointer"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground font-medium">Session Fee (₹/hr)</label>
                  <Input
                    type="number"
                    min={0}
                    value={formFeeAdvanced}
                    disabled={!formLevels.includes("ADVANCED")}
                    onChange={(e) => setFormFeeAdvanced(e.target.value)}
                    placeholder="850"
                    className="h-8 text-xs font-mono"
                    required={formLevels.includes("ADVANCED")}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5 leading-tight">
                  Match strategy, deceptive play, speed & power
                </p>
              </div>
            </div>
          </div>

          <Field label="Bio / Specialization" hint="Brief summary of strengths and coaching style">
            <textarea
              value={formBio}
              onChange={(e) => setFormBio(e.target.value)}
              rows={2}
              placeholder="e.g. Specializes in advanced footwork, smash technique, and defensive transitions…"
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone Number" hint="Direct contact for booking coordination">
              <Input
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                placeholder="+91 98765 43210"
              />
            </Field>

            <Field label="Email Address">
              <Input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="coach@bcos.app"
              />
            </Field>
          </div>

          {/* Available Days */}
          <div className="space-y-2 pt-1 border-t border-border/50">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground">Available Days of Week</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormDays([...DAYS_OF_WEEK])}
                  className="text-[11px] text-primary hover:underline"
                >
                  All Days
                </button>
                <button
                  type="button"
                  onClick={() => setFormDays(["SATURDAY", "SUNDAY"])}
                  className="text-[11px] text-primary hover:underline"
                >
                  Weekends
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {DAYS_OF_WEEK.map((d) => {
                const selected = formDays.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(d)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                      selected
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {d.slice(0, 3)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Available Timings */}
          <div className="space-y-2 pt-1 border-t border-border/50">
            <label className="text-xs font-semibold text-foreground">Available Time Slots</label>
            <p className="text-[11px] text-muted-foreground">
              Select available session slots for this coach.
            </p>

            <div className="flex flex-wrap gap-1.5">
              {DEFAULT_COACHING_SLOTS.map((s) => {
                const selected = formSlots.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSlot(s)}
                    className={`rounded-lg px-2 py-1 text-[11px] font-mono transition-all ${
                      selected
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>

            {/* Custom slot entry */}
            <div className="flex items-center gap-2 pt-1">
              <Input
                value={customSlotInput}
                onChange={(e) => setCustomSlotInput(e.target.value)}
                placeholder="Custom slot e.g. 10:00 - 11:00"
                className="h-8 text-xs font-mono"
              />
              <Button type="button" variant="outline" size="sm" onClick={addCustomSlot} className="h-8 text-xs shrink-0">
                Add Slot
              </Button>
            </div>
          </div>

          {editingCoach && (
            <div className="pt-2 border-t border-border/50">
              <label className="flex items-center gap-2.5 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <span className="font-semibold text-foreground">Active for booking</span>
              </label>
            </div>
          )}

          <div className="pt-4 flex justify-end gap-2 border-t border-border/60">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={savingCoach} className="gap-1.5 text-xs">
              {savingCoach ? <Spinner className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {savingCoach ? "Saving…" : editingCoach ? "Save Changes" : "Create Coach"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

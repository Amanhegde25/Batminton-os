"use client";

import Link from "next/link";
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
  Spinner,
  Table,
  Tabs,
  Td,
  useToast
} from "@/components/ui";
import {
  Award,
  Brain,
  Calendar,
  Clock,
  RefreshCw,
  CheckCircle2,
  X,
  ArrowRight
} from "@/components/icons";

interface CoachItem {
  id: string;
  name: string;
  title: string | null;
  bio: string | null;
  phone: string | null;
  email: string | null;
  photoUrl: string | null;
  hourlyFee: number;
  availableDays: string[];
  availableTimeSlots: string[];
  active: boolean;
}

interface CoachingBookingItem {
  id: string;
  coachId: string;
  coachName: string;
  userId: string;
  userName: string;
  sessionDate: string;
  dayOfWeek: string;
  timeSlot: string;
  notes: string | null;
  fee: number;
  status: "CONFIRMED" | "COMPLETED" | "CANCELLED";
  createdAt: string;
}

function getDayOfWeek(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const map = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
  return map[d.getUTCDay()];
}

export default function CoachingPage() {
  const { activeClubId } = useSession();
  const [tab, setTab] = useState("coaches");
  const [coaches, setCoaches] = useState<CoachItem[]>([]);
  const [myBookings, setMyBookings] = useState<CoachingBookingItem[]>([]);
  const [allClubBookings, setAllClubBookings] = useState<CoachingBookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast, node } = useToast();

  // Booking modal state
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [selectedCoach, setSelectedCoach] = useState<CoachItem | null>(null);
  const [bookDate, setBookDate] = useState("");
  const [bookSlot, setBookSlot] = useState("");
  const [bookNotes, setBookNotes] = useState("");
  const [submittingBooking, setSubmittingBooking] = useState(false);

  const loadData = useCallback(async () => {
    if (!activeClubId) return;
    setLoading(true);
    try {
      const [coachesRes, myBookingsRes, clubBookingsRes] = await Promise.all([
        api<{ items: CoachItem[] }>(`/clubs/${activeClubId}/coaches?onlyActive=true`),
        api<{ items: CoachingBookingItem[] }>(`/clubs/${activeClubId}/coaches/bookings?myOnly=true`),
        api<{ items: CoachingBookingItem[] }>(`/clubs/${activeClubId}/coaches/bookings`)
      ]);
      setCoaches(coachesRes.items || []);
      setMyBookings(myBookingsRes.items || []);
      setAllClubBookings(clubBookingsRes.items || []);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to load coaching data", "error");
    } finally {
      setLoading(false);
    }
  }, [activeClubId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function startBooking(coach: CoachItem) {
    setSelectedCoach(coach);
    // Suggest tomorrow's date
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const dateStr = d.toISOString().split("T")[0];
    setBookDate(dateStr);
    setBookSlot(coach.availableTimeSlots[0] || "");
    setBookNotes("");
    setBookingModalOpen(true);
  }

  async function handleConfirmBooking(e: React.FormEvent) {
    e.preventDefault();
    if (!activeClubId || !selectedCoach) return;
    if (!bookDate) return toast("Select a session date", "error");
    if (!bookSlot) return toast("Select a time slot", "error");

    const selectedDay = getDayOfWeek(bookDate);
    if (!selectedCoach.availableDays.includes(selectedDay)) {
      return toast(
        `${selectedCoach.name} is not available on ${selectedDay}s. Available: ${selectedCoach.availableDays.join(", ")}`,
        "error"
      );
    }

    setSubmittingBooking(true);
    try {
      await api(`/clubs/${activeClubId}/coaches/bookings`, {
        method: "POST",
        json: {
          coachId: selectedCoach.id,
          sessionDate: bookDate,
          timeSlot: bookSlot,
          notes: bookNotes.trim() || undefined
        }
      });
      toast("Coaching session successfully booked! 🏸");
      setBookingModalOpen(false);
      void loadData();
      setTab("my-sessions");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Booking failed", "error");
    } finally {
      setSubmittingBooking(false);
    }
  }

  async function cancelBooking(bookingId: string) {
    if (!confirm("Are you sure you want to cancel this coaching session?")) return;
    try {
      await api(`/clubs/${activeClubId}/coaches/bookings/${bookingId}`, {
        method: "PATCH",
        json: { action: "cancel" }
      });
      toast("Session booking cancelled");
      void loadData();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to cancel", "error");
    }
  }

  // Calculate day and conflict for currently chosen booking date
  const chosenDay = bookDate ? getDayOfWeek(bookDate) : "";
  const isCoachAvailableOnChosenDay = selectedCoach
    ? selectedCoach.availableDays.includes(chosenDay)
    : false;

  // Filter slots already booked for chosen date and coach
  const takenSlotsForDate = allClubBookings
    .filter(
      (b) =>
        b.coachId === selectedCoach?.id &&
        b.sessionDate === bookDate &&
        b.status !== "CANCELLED"
    )
    .map((b) => b.timeSlot);

  return (
    <div className="space-y-6 max-w-4xl">
      {node}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Award className="h-6 w-6 text-primary" /> Club Coaching & Training
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Book certified badminton coaches, schedule targeted training, and level up your match technique.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="gap-1.5 text-xs self-start sm:self-auto">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* Banner linking to AI Coaching */}
      <Card className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-muted/30 border-border/70">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500">
            <Brain className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-foreground">Want Algorithmic Match Intelligence?</h4>
            <p className="text-[11px] text-muted-foreground">
              Review weekly AI coaching insights, focus areas, and drill suggestions in the AI Lab.
            </p>
          </div>
        </div>
        <Link href="/app/ai-coaching" className="shrink-0">
          <Button variant="outline" size="sm" className="gap-1 text-xs w-full sm:w-auto h-7">
            AI Coaching <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      </Card>

      <Tabs
        tabs={[
          { key: "coaches", label: `Book a Coach (${coaches.length})` },
          { key: "my-sessions", label: `My Sessions (${myBookings.length})` }
        ]}
        active={tab}
        onChange={setTab}
      />

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner className="h-8 w-8 text-primary" />
        </div>
      ) : tab === "coaches" ? (
        /* Tab: Book a Coach */
        <div className="space-y-4">
          {coaches.length === 0 ? (
            <Card className="p-12 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Award className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold">No Coaches Currently Available</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Your club administrators haven't added coaches or schedules to the roster yet. Check back soon!
              </p>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {coaches.map((coach) => (
                <Card
                  key={coach.id}
                  className="p-5 flex flex-col justify-between space-y-4 hover:border-primary/50 transition-all shadow-sm"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-bold text-foreground">{coach.name}</h3>
                        {coach.title && (
                          <p className="text-xs font-semibold text-primary">{coach.title}</p>
                        )}
                      </div>
                      <Badge tone="primary" className="text-xs font-mono font-bold">
                        ₹{Math.round(coach.hourlyFee / 100)} / hr
                      </Badge>
                    </div>

                    {coach.bio && (
                      <p className="text-xs text-muted-foreground leading-relaxed">{coach.bio}</p>
                    )}

                    <div className="rounded-xl bg-muted/30 p-3 space-y-2 border border-border/50 text-xs">
                      <div>
                        <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1 mb-1">
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

                      <div className="pt-1">
                        <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1 mb-1">
                          <Clock className="h-3 w-3 text-primary" /> Available Slots:
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

                  <div className="pt-2 flex justify-end">
                    <Button onClick={() => startBooking(coach)} className="gap-1.5 text-xs w-full sm:w-auto">
                      <Calendar className="h-3.5 w-3.5" /> Book Session
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Tab: My Booked Sessions */
        <div className="space-y-4">
          <Card className="p-0 overflow-hidden">
            <Table head={["Coach", "Date & Day", "Time Slot", "Fee", "Status", "Notes", "Action"]}>
              {myBookings.map((b) => (
                <tr key={b.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <Td>
                    <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                      <Award className="h-4 w-4 text-primary" /> {b.coachName}
                    </span>
                  </Td>
                  <Td className="text-xs">
                    <div className="font-medium text-foreground">{b.sessionDate}</div>
                    <div className="text-[10px] font-mono uppercase text-muted-foreground">{b.dayOfWeek}</div>
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
                  <Td className="text-xs text-muted-foreground max-w-xs truncate">
                    {b.notes || "—"}
                  </Td>
                  <Td>
                    {b.status === "CONFIRMED" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void cancelBooking(b.id)}
                        className="h-7 text-[11px] text-destructive hover:bg-destructive/10"
                      >
                        Cancel
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground font-mono">—</span>
                    )}
                  </Td>
                </tr>
              ))}
              {myBookings.length === 0 && (
                <tr>
                  <Td colSpan={7} className="py-12 text-center text-xs text-muted-foreground">
                    You haven't booked any coaching sessions yet. Pick a coach above to schedule your first session!
                  </Td>
                </tr>
              )}
            </Table>
          </Card>
        </div>
      )}

      {/* Booking Modal */}
      {selectedCoach && (
        <Dialog
          open={bookingModalOpen}
          onClose={() => setBookingModalOpen(false)}
          title={`Book Session with ${selectedCoach.name}`}
        >
          <form onSubmit={handleConfirmBooking} className="space-y-4">
            <div className="rounded-xl bg-muted/40 p-3 border border-border/60 flex items-center justify-between text-xs">
              <div>
                <p className="font-semibold text-foreground">{selectedCoach.name}</p>
                <p className="text-muted-foreground text-[11px]">{selectedCoach.title || "Coach"}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-primary font-mono">₹{Math.round(selectedCoach.hourlyFee / 100)}</p>
                <p className="text-[10px] text-muted-foreground">per session</p>
              </div>
            </div>

            <Field label="Session Date" hint="Choose the date for your coaching session">
              <Input
                type="date"
                value={bookDate}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => setBookDate(e.target.value)}
                required
              />
            </Field>

            {bookDate && (
              <div className="text-xs">
                {isCoachAvailableOnChosenDay ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> {selectedCoach.name} is available on {chosenDay}s.
                  </span>
                ) : (
                  <span className="text-destructive font-medium flex items-center gap-1">
                    <X className="h-3.5 w-3.5" /> Not available on {chosenDay}s. Coach works on: {selectedCoach.availableDays.join(", ")}
                  </span>
                )}
              </div>
            )}

            <Field label="Time Slot" hint="Pick an available coaching slot">
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                {selectedCoach.availableTimeSlots.map((slot) => {
                  const isBooked = takenSlotsForDate.includes(slot);
                  const selected = bookSlot === slot;
                  return (
                    <button
                      key={slot}
                      type="button"
                      disabled={isBooked}
                      onClick={() => setBookSlot(slot)}
                      className={`p-2 rounded-lg text-xs font-mono transition-all text-center border ${
                        isBooked
                          ? "opacity-40 cursor-not-allowed bg-muted/30 border-dashed border-border"
                          : selected
                          ? "bg-primary text-primary-foreground font-bold border-primary shadow-xs"
                          : "bg-card hover:bg-muted/50 border-border/70 text-foreground"
                      }`}
                    >
                      {slot} {isBooked ? "• Booked" : ""}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="Training Focus / Notes (Optional)" hint="e.g. Footwork drills, smash power, doubles tactics">
              <Input
                value={bookNotes}
                onChange={(e) => setBookNotes(e.target.value)}
                placeholder="What would you like to focus on?"
                maxLength={200}
              />
            </Field>

            <div className="pt-3 flex justify-end gap-2 border-t border-border/60">
              <Button type="button" variant="ghost" onClick={() => setBookingModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submittingBooking || !isCoachAvailableOnChosenDay || !bookSlot}
                className="gap-1.5 text-xs"
              >
                {submittingBooking ? <Spinner className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                {submittingBooking ? "Booking…" : "Confirm Session"}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}

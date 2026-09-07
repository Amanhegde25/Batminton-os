"use client";

import { useEffect, useState } from "react";
import { SessionProvider, useSession } from "@/components/session";
import { api } from "@/lib/client";
import { Badge, Button, Card, Field, Input, Select, Spinner } from "@/components/ui";
import { Dialog, Table, Tabs, Td, useToast } from "@/components/ui";

interface Court {
  id: string;
  name: string;
  number: number;
  type: string;
  status: string;
  effectiveStatus?: string;
  occupancy?: { kind: string; label: string } | null;
  openHour: number;
  closeHour: number;
  hourlyFee: number;
}
interface Booking {
  id: string;
  courtId: string;
  court?: { id: string; name: string; number: number };
  startTime: string;
  endTime: string;
  status: string;
  feeAmount: number;
  notes: string | null;
  user?: { id: string; name: string; photoUrl: string | null };
}

function money(n: number) {
  return `₹${(Math.abs(n) / 100).toLocaleString("en-IN")}`;
}

function CourtsInner() {
  const { me, activeClubId, activeMembership } = useSession();
  const [tab, setTab] = useState("courts");
  const [courts, setCourts] = useState<Court[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [bookCourt, setBookCourt] = useState<Court | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const { toast, node } = useToast();

  const isStaff = ["OWNER", "ADMIN"].includes(activeMembership?.role ?? "");

  async function load() {
    if (!activeClubId) return;
    setLoading(true);
    try {
      if (tab === "courts") {
        setCourts(await api<Court[]>(`/clubs/${activeClubId}/courts`));
      } else {
        setBookings(await api<Booking[]>(`/clubs/${activeClubId}/bookings?date=${date}`));
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to load", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClubId, tab, date]);

  async function book(form: { start: string; end: string; forEmail?: string }) {
    if (!bookCourt || !me) return;
    await api(`/clubs/${activeClubId}/bookings`, {
      method: "POST",
      json: {
        courtId: bookCourt.id,
        startTime: new Date(`${date}T${form.start}:00`).toISOString(),
        endTime: new Date(`${date}T${form.end}:00`).toISOString()
      }
    });
    toast("Court booked — fee charged to your wallet");
    setBookCourt(null);
    void load();
  }

  async function cancel(id: string) {
    try {
      await api(`/clubs/${activeClubId}/bookings?bookingId=${id}`, { method: "DELETE" });
      toast("Booking cancelled");
      void load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Cancel failed", "error");
    }
  }

  async function addCourt(form: { name: string; hourlyFee: string; openHour: string; closeHour: string }) {
    await api(`/clubs/${activeClubId}/courts`, {
      method: "POST",
      json: {
        name: form.name,
        hourlyFee: Math.round(Number(form.hourlyFee || 0) * 100),
        openHour: Number(form.openHour || 6),
        closeHour: Number(form.closeHour || 22)
      }
    });
    toast("Court added");
    setAddOpen(false);
    void load();
  }

  return (
    <div className="space-y-4">
      {node}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Courts & Bookings</h1>
        <div className="flex gap-2">
          <Tabs
            tabs={[
              { key: "courts", label: "Live board" },
              { key: "bookings", label: "Bookings" }
            ]}
            active={tab}
            onChange={setTab}
          />
          {isStaff && tab === "courts" && <Button onClick={() => setAddOpen(true)}>+ Add court</Button>}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : tab === "courts" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courts.map((c) => {
            const occupied = c.effectiveStatus === "OCCUPIED";
            return (
              <Card key={c.id} className={`p-5 ${occupied ? "border-amber-400/40" : ""}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">
                      Court {c.number} · {c.name}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {c.type.toLowerCase()} · {c.openHour}:00–{c.closeHour}:00
                      {c.hourlyFee > 0 ? ` · ${money(c.hourlyFee)}/hr` : " · free"}
                    </p>
                  </div>
                  <Badge tone={occupied ? "warning" : "success"}>{occupied ? "Occupied" : c.status.toLowerCase()}</Badge>
                </div>
                {c.occupancy && <p className="mt-3 rounded-lg bg-muted px-3 py-1.5 text-xs">{c.occupancy.label}</p>}
                {c.effectiveStatus !== "OCCUPIED" && c.status === "AVAILABLE" && (
                  <Button size="sm" className="mt-3 w-full" onClick={() => setBookCourt(c)}>
                    Book this court
                  </Button>
                )}
              </Card>
            );
          })}
          {courts.length === 0 && (
            <Card className="col-span-full p-10 text-center text-sm text-muted-foreground">
              No courts yet. {isStaff ? "Add your first court." : ""}
            </Card>
          )}
        </div>
      ) : (
        <>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="max-w-xs" />
          <Table head={["Court", "When", "Booked by", "Fee", "Status", ""]}>
            {bookings.map((b) => (
              <tr key={b.id} className="border-b last:border-0">
                <Td>{b.court ? `#${b.court.number} ${b.court.name}` : b.courtId.slice(0, 6)}</Td>
                <Td className="text-xs">
                  {new Date(b.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} –{" "}
                  {new Date(b.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Td>
                <Td>{b.user?.name ?? "—"}</Td>
                <Td className="tabular-nums">{b.feeAmount > 0 ? money(b.feeAmount) : "Free"}</Td>
                <Td>
                  <Badge tone={b.status === "CONFIRMED" ? "success" : b.status === "CANCELLED" ? "muted" : "warning"}>
                    {b.status.toLowerCase()}
                  </Badge>
                </Td>
                <Td>
                  {b.status === "CONFIRMED" && (
                    <Button size="sm" variant="ghost" onClick={() => cancel(b.id)}>
                      Cancel
                    </Button>
                  )}
                </Td>
              </tr>
            ))}
            {bookings.length === 0 && (
              <tr>
                <Td colSpan={6} className="py-10 text-center text-muted-foreground">
                  No bookings on this day.
                </Td>
              </tr>
            )}
          </Table>
        </>
      )}

      <Dialog open={!!bookCourt} onClose={() => setBookCourt(null)} title={`Book Court ${bookCourt?.number ?? ""}`}>
        <BookingForm court={bookCourt} onSubmit={book} />
      </Dialog>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} title="Add a court">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
            await addCourt({
              name: f.name ?? "",
              hourlyFee: f.hourlyFee ?? "0",
              openHour: f.openHour ?? "6",
              closeHour: f.closeHour ?? "22"
            });
          }}
        >
          <Field label="Court name">
            <Input name="name" required placeholder="Centre Court" />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Open hour">
              <Input name="openHour" type="number" min={0} max={23} defaultValue={6} />
            </Field>
            <Field label="Close hour">
              <Input name="closeHour" type="number" min={1} max={24} defaultValue={22} />
            </Field>
            <Field label="Fee ₹/hr">
              <Input name="hourlyFee" type="number" min={0} step="any" defaultValue={0} />
            </Field>
          </div>
          <Button type="submit" className="w-full">
            Add court
          </Button>
        </form>
      </Dialog>
    </div>
  );
}

function isStaffOrCoach(role?: string) {
  return ["OWNER", "ADMIN", "COACH"].includes(role ?? "");
}

function BookingForm({ court, onSubmit }: { court: Court | null; onSubmit: (f: { start: string; end: string }) => Promise<void> }) {
  const [start, setStart] = useState("19:00");
  const [end, setEnd] = useState("20:00");
  const [busy, setBusy] = useState(false);
  const hours = end > start ? Math.max(0, (Number(end.slice(0, 2)) - Number(start.slice(0, 2)))) : 0;
  const fee = ((court?.hourlyFee ?? 0) / 100) * hours;
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await onSubmit({ start, end });
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start time">
          <Select value={start} onChange={(e) => setStart(e.target.value)}>
            {Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`).map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="End time">
          <Select value={end} onChange={(e) => setEnd(e.target.value)}>
            {Array.from({ length: 24 }, (_, h) => `${String(h + 1).padStart(2, "0")}:00`).map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
      </div>
      {fee > 0 && <p className="rounded-lg bg-muted px-3 py-2 text-sm">Estimated fee: <b>{money(fee * 100)}</b> (charged to wallet)</p>}
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Booking…" : "Confirm booking"}
      </Button>
    </form>
  );
}

export default function CourtsPage() {
  return (
    <SessionProvider>
      <CourtsInner />
    </SessionProvider>
  );
}

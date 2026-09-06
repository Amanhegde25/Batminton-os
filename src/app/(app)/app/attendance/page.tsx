"use client";

import { useEffect, useState } from "react";
import { SessionProvider, useSession } from "@/components/session";
import { api } from "@/lib/client";
import { Avatar, Badge, Button, Card, Input, Spinner } from "@/components/ui";
import { Dialog, Tabs, useToast } from "@/components/ui";

interface RosterRow {
  userId: string;
  name: string;
  photoUrl: string | null;
  status: string | null;
  method: string | null;
  checkInTime: string | null;
}

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "muted" | "accent"> = {
  PRESENT: "success",
  LATE: "warning",
  ABSENT: "danger",
  GUEST: "accent",
  EXCUSED: "muted"
};

function AttendanceInner() {
  const { me, activeClubId, activeMembership } = useSession();
  const [tab, setTab] = useState("today");
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [matrix, setMatrix] = useState<{ days: string[]; rows: { userId: string; name: string; cells: (string | null)[] }[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrOpen, setQrOpen] = useState(false);
  const [token, setToken] = useState("");
  const [scanning, setScanning] = useState(false);
  const { toast, node } = useToast();

  const isStaff = ["OWNER", "ADMIN"].includes(activeMembership?.role ?? "");

  async function loadRoster(d = day) {
    if (!activeClubId) return;
    setLoading(true);
    try {
      const data = await api<{
        rows?: RosterRow[];
        roster?: { member: { userId: string; user: { name: string; photoUrl: string | null } }; record: { status: string | null; method: string | null; createdAt: string } | null }[];
      }>(`/clubs/${activeClubId}/attendance?date=${d}`);
      if (Array.isArray(data.rows)) {
        setRoster(data.rows);
      } else if (Array.isArray(data.roster)) {
        setRoster(
          data.roster.map((r) => ({
            userId: r.member.userId,
            name: r.member.user.name,
            photoUrl: r.member.user.photoUrl,
            status: r.record?.status ?? null,
            method: r.record?.method ?? null,
            checkInTime: r.record?.createdAt ?? null
          }))
        );
      } else {
        setRoster([]);
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to load roster", "error");
    } finally {
      setLoading(false);
    }
  }

  async function loadMatrix() {
    if (!activeClubId) return;
    setLoading(true);
    try {
      setMatrix(await api(`/clubs/${activeClubId}/attendance?view=month`));
    } catch {
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (tab === "month") void loadMatrix();
    else void loadRoster(day);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClubId, tab]);

  async function issueQr() {
    try {
      const res = await api<{ token: string; expiresInSec: number }>(`/clubs/${activeClubId}/attendance/qr`);
      setToken(res.token);
      setQrOpen(true);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not generate QR", "error");
    }
  }

  async function scan(tokenValue: string) {
    setScanning(true);
    try {
      const res = await api<{ status: string; late: boolean }>(`/clubs/${activeClubId}/attendance/checkin`, {
        method: "POST",
        json: { method: "QR", token: tokenValue }
      });
      toast(`Welcome! Marked ${res.status}${res.late ? " (late)" : ""}.`);
      void loadRoster(day);
      setQrOpen(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Check-in failed", "error");
    } finally {
      setScanning(false);
    }
  }

  async function selfCheckIn() {
    try {
      const res = await api<{ status: string; late: boolean }>(`/clubs/${activeClubId}/attendance/checkin`, {
        method: "POST",
        json: { method: "MANUAL" }
      });
      toast(`You're marked ${res.status}.`);
      void loadRoster(day);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Check-in failed", "error");
    }
  }

  async function sweep() {
    try {
      const res = await api<{ absentees: number; penalised: number; amount: number }>(`/clubs/${activeClubId}/attendance/run-daily`, {
        method: "POST",
        json: {}
      });
      toast(`Sweep done: ${res.absentees} absentees, ₹${(res.amount / 100).toLocaleString("en-IN")} fined.`);
      void loadRoster(day);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Sweep failed", "error");
    }
  }

  async function mark(row: RosterRow, status: string) {
    try {
      await api(`/clubs/${activeClubId}/attendance/checkin`, {
        method: "POST",
        json: { userId: row.userId, status, method: "MANUAL" }
      });
      void loadRoster(day);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Mark failed", "error");
    }
  }

  return (
    <div className="space-y-4">
      {node}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Attendance</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={selfCheckIn}>
            ✅ Check in
          </Button>
          {isStaff && (
            <>
              <Button variant="secondary" onClick={issueQr}>
                Generate QR
              </Button>
              <Button variant="destructive" onClick={sweep}>
                Run daily sweep
              </Button>
            </>
          )}
        </div>
      </div>

      <Tabs
        tabs={[
          { key: "today", label: "Daily roster" },
          { key: "month", label: "Month matrix" }
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "today" && (
        <>
          <div className="flex max-w-sm items-end gap-2">
            <Input type="date" value={day} onChange={(e) => { setDay(e.target.value); void loadRoster(e.target.value); }} />
          </div>
          {loading ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : (
            <Card className="divide-y">
              {roster.map((r) => (
                <div key={r.userId} className="flex items-center justify-between gap-3 p-3.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={r.name} src={r.photoUrl} size={34} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{r.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.checkInTime ? `Checked in ${new Date(r.checkInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Not checked in"}
                        {r.method ? ` · ${r.method}` : ""}
                      </p>
                    </div>
                  </div>
                  {isStaff ? (
                    <div className="flex items-center gap-1.5">
                      <Badge tone={STATUS_TONE[r.status ?? "ABSENT"] ?? "muted"}>{r.status ?? "ABSENT"}</Badge>
                      <Button size="sm" variant="outline" onClick={() => mark(r, "PRESENT")}>
                        P
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => mark(r, "LATE")}>
                        L
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => mark(r, "EXCUSED")}>
                        E
                      </Button>
                    </div>
                  ) : (
                    r.status && <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                  )}
                </div>
              ))}
              {roster.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No members found.</p>}
            </Card>
          )}
        </>
      )}

      {tab === "month" && matrix && Array.isArray(matrix.days) && Array.isArray(matrix.rows) && (
        <Card className="overflow-x-auto p-4">
          <table className="text-[11px]">
            <thead>
              <tr>
                <th className="sticky left-0 bg-card px-2 py-1 text-left">Player</th>
                {matrix.days.map((d) => (
                  <th key={d} className="px-0.5 font-normal text-muted-foreground">
                    {Number(d.slice(-2))}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.rows.map((row) => (
                <tr key={row.userId}>
                  <td className="sticky left-0 whitespace-nowrap bg-card px-2 py-1 text-left text-[11px] font-medium">
                    {row.name}
                  </td>
                  {row.cells.map((c, i) => (
                    <td key={i} className="px-0.5 py-1 text-center">
                      <span
                        className={`inline-block h-4 w-4 rounded ${
                          c === "PRESENT"
                            ? "bg-emerald-500/80"
                            : c === "LATE"
                              ? "bg-amber-500/80"
                              : c === "ABSENT"
                                ? "bg-red-400/70"
                                : c === "GUEST" || c === "EXCUSED"
                                  ? "bg-sky-400/70"
                                  : "bg-muted"
                        }`}
                        title={`${matrix.days[i]}: ${c ?? "-"}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 flex gap-3 text-[10px] text-muted-foreground">
            <span>🟩 Present</span><span>🟨 Late</span><span>🟥 Absent</span><span>🟦 Excused/Guest</span><span>⬜ No record</span>
          </div>
        </Card>
      )}

      <Dialog open={qrOpen} onClose={() => setQrOpen(false)} title="Today's QR code">
        <div className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            Players scan this at the venue (or paste the token below). Valid for 30 minutes.
          </p>
          {token && (
            <>
              <div className="mx-auto w-fit rounded-xl border bg-white p-3 dark:bg-white/90">
                <QrFallback token={token} />
              </div>
              <button
                type="button"
                className="w-full break-all rounded-lg bg-muted px-3 py-2 font-mono text-[11px] text-muted-foreground hover:text-foreground"
                onClick={() => {
                  void navigator.clipboard?.writeText(token);
                  toast("Token copied");
                }}
              >
                {token.slice(0, 60)}… (click to copy)
              </button>
            </>
          )}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void scan((e.currentTarget.elements.namedItem("tok") as HTMLInputElement).value);
            }}
          >
            <Input name="tok" placeholder="…or paste a token to scan" disabled={scanning} />
            <Button type="submit" disabled={scanning}>
              Scan
            </Button>
          </form>
        </div>
      </Dialog>
    </div>
  );
}

function QrFallback({ token }: { token: string }) {
  const cells = 21;
  let seed = 0;
  for (let i = 0; i < token.length; i++) seed = (seed * 31 + token.charCodeAt(i)) >>> 0;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const grid: boolean[][] = Array.from({ length: cells }, () =>
    Array.from({ length: cells }, () => rand() > 0.52)
  );
  const finder = (r: number, c: number) => (r < 7 && c < 7) || (r < 7 && c >= cells - 7) || (r >= cells - 7 && c < 7);
  return (
    <svg width={200} height={200} viewBox={`0 0 ${cells} ${cells}`} shapeRendering="crispEdges">
      <rect width={cells} height={cells} fill="white" />
      {grid.map((row, ri) =>
        row.map((on, ci) =>
          on && !finder(ri, ci) ? <rect key={`${ri}-${ci}`} x={ci} y={ri} width={1} height={1} fill="#111" /> : null
        )
      )}
      {[
        [0, 0],
        [0, cells - 7],
        [cells - 7, 0]
      ].map(([r, c], i) => (
        <g key={i}>
          <rect x={c} y={r} width={7} height={7} fill="#111" />
          <rect x={c + 1} y={r + 1} width={5} height={5} fill="white" />
          <rect x={c + 2} y={r + 2} width={3} height={3} fill="#111" />
        </g>
      ))}
    </svg>
  );
}

export default function AttendancePage() {
  return (
    <SessionProvider>
      <AttendanceInner />
    </SessionProvider>
  );
}

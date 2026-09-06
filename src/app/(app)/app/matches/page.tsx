"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "@/components/session";
import { api } from "@/lib/client";
import { Badge, Button, Card, Field, Input, Select, Spinner } from "@/components/ui";
import { Dialog, Tabs, useToast } from "@/components/ui";

interface MatchRow {
  id: string;
  type: string;
  status: string;
  winnerTeamIndex: number | null;
  scheduledAt: string;
  court?: { id: string; name: string; number: number } | null;
  teams: { teamIndex: number; players: { id: string; name: string }[] }[];
  scores: { setNumber: number; a: number; b: number }[];
}

function matchLabel(m: MatchRow): string {
  const names = (t: { players: { name: string }[] }) => t.players.map((p) => p.name).join(" & ") || "TBD";
  return `${names(m.teams[0])} vs ${names(m.teams[1])}`;
}

function scoresText(m: MatchRow): string {
  if (!m.scores.length) return "";
  return m.scores.map((s) => `${s.a}-${s.b}`).join(", ");
}

const TAB_STATUS: Record<string, string[] | undefined> = {
  live: ["LIVE", "IN_PROGRESS"],
  upcoming: ["SCHEDULED", "READY"],
  done: ["COMPLETED", "WALKOVER"],
  all: undefined
};

function MatchesInner() {
  const { activeClubId, activeMembership } = useSession();
  const [tab, setTab] = useState<"live" | "upcoming" | "done" | "all">("upcoming");
  const [rows, setRows] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const { toast, node } = useToast();

  const canCreate = ["OWNER", "ADMIN", "COACH"].includes(activeMembership?.role ?? "");

  async function load(p = 1) {
    if (!activeClubId) return;
    setLoading(true);
    try {
      const statuses = TAB_STATUS[tab];
      const qs = new URLSearchParams({ page: String(p), pageSize: "20" });
      if (statuses) qs.set("status", statuses.join(","));
      const data = await api<{ items: MatchRow[]; total: number; pageSize: number }>(
        `/clubs/${activeClubId}/matches?${qs.toString()}`
      );
      setRows(data.items);
      setTotalPages(Math.max(1, Math.ceil(data.total / data.pageSize)));
      setPage(p);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to load matches", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClubId, tab]);

  function tone(status: string): "danger" | "success" | "muted" | "warning" {
    return status === "LIVE" || status === "IN_PROGRESS"
      ? "danger"
      : status === "COMPLETED"
        ? "success"
        : status === "WALKOVER"
          ? "warning"
          : "muted";
  }

  return (
    <div className="space-y-4">
      {node}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Matches</h1>
        <div className="flex flex-wrap gap-2">
          <Tabs
            tabs={[
              { key: "live", label: "Live" },
              { key: "upcoming", label: "Upcoming" },
              { key: "done", label: "Results" },
              { key: "all", label: "All" }
            ]}
            active={tab}
            onChange={(k) => setTab(k as typeof tab)}
          />
          {canCreate && <Button onClick={() => setCreateOpen(true)}>+ New match</Button>}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <Card className="divide-y">
          {rows.map((m) => (
            <Link key={m.id} href={`/app/matches/${m.id}`} className="flex items-center justify-between gap-4 p-4 hover:bg-muted">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{matchLabel(m)}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(m.scheduledAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  {m.court ? ` · #${m.court.number} ${m.court.name}` : ""}
                  {m.type === "DOUBLES" ? " · Doubles" : " · Singles"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {scoresText(m) && <span className="text-sm tabular-nums">{scoresText(m)}</span>}
                <Badge tone={tone(m.status)}>{m.status === "IN_PROGRESS" ? "LIVE" : m.status.toLowerCase()}</Badge>
              </div>
            </Link>
          ))}
          {rows.length === 0 && (
            <p className="p-10 text-center text-sm text-muted-foreground">No matches here yet.</p>
          )}
        </Card>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => void load(page - 1)}>
            ← Prev
          </Button>
          <span className="text-muted-foreground">Page {page} of {totalPages}</span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => void load(page + 1)}>
            Next →
          </Button>
        </div>
      )}

      <CreateMatchDialog open={createOpen} onClose={() => setCreateOpen(false)} clubId={activeClubId ?? ""} onDone={() => void load(1)} />
    </div>
  );
}

function CreateMatchDialog({
  open,
  onClose,
  clubId,
  onDone
}: {
  open: boolean;
  onClose: () => void;
  clubId: string;
  onDone: () => void;
}) {
  const [members, setMembers] = useState<{ userId: string; name: string; rating: number }[]>([]);
  const [courts, setCourts] = useState<{ id: string; name: string; number: number; status: string }[]>([]);
  const [type, setType] = useState("DOUBLES");
  const [teamA, setTeamA] = useState<string[]>([]);
  const [teamB, setTeamB] = useState<string[]>([]);
  const [courtId, setCourtId] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  void toast;

  useEffect(() => {
    if (!open || !clubId) return;
    void api<{ userId: string; name: string; rating: number }[]>(`/clubs/${clubId}/members?status=ACTIVE`)
      .then(setMembers)
      .catch(() => {});
    void api<{ id: string; name: string; number: number; status: string }[]>(`/clubs/${clubId}/courts`)
      .then(setCourts)
      .catch(() => {});
  }, [open, clubId]);

  const expected = type === "SINGLES" ? 1 : 2;
  const used = [...teamA, ...teamB];

  function toggle(list: string[], setList: (v: string[]) => void, id: string) {
    if (list.includes(id)) setList(list.filter((x) => x !== id));
    else if (list.length < expected && !used.includes(id)) setList([...list, id]);
  }

  return (
    <Dialog open={open} onClose={onClose} title="Schedule a match">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api(`/clubs/${clubId}/matches`, {
              method: "POST",
              json: {
                type,
                teamAUserIds: teamA,
                teamBUserIds: teamB,
                courtId: courtId || undefined
              }
            });
            onClose();
            onDone();
          } catch (err) {
            toast(err instanceof Error ? err.message : "Could not create match", "error");
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Format">
          <Select value={type} onChange={(e) => { setType(e.target.value); setTeamA([]); setTeamB([]); }}>
            <option value="DOUBLES">Doubles (2v2)</option>
            <option value="SINGLES">Singles (1v1)</option>
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={`Team A (${teamA.length}/${expected})`}>
            <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border p-2">
              {members.map((m) => (
                <label key={m.userId} className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={teamA.includes(m.userId)}
                    onChange={() => toggle(teamA, setTeamA, m.userId)}
                  />
                  {m.name}
                </label>
              ))}
            </div>
          </Field>
          <Field label={`Team B (${teamB.length}/${expected})`}>
            <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border p-2">
              {members.map((m) => (
                <label key={m.userId} className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={teamB.includes(m.userId)}
                    onChange={() => toggle(teamB, setTeamB, m.userId)}
                  />
                  {m.name}
                </label>
              ))}
            </div>
          </Field>
        </div>

        <Field label="Court (optional)">
          <Select value={courtId} onChange={(e) => setCourtId(e.target.value)}>
            <option value="">Auto / none</option>
            {courts.filter((c) => c.status === "AVAILABLE").map((c) => (
              <option key={c.id} value={c.id}>
                #{c.number} {c.name}
              </option>
            ))}
          </Select>
        </Field>

        <Button type="submit" disabled={busy || teamA.length !== expected || teamB.length !== expected} className="w-full">
          {busy ? "Creating…" : "Create match"}
        </Button>
      </form>
    </Dialog>
  );
}

export default function MatchesPage() {
  return <MatchesInner />;
}

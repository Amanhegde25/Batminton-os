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

interface HistoryRow {
  id: string;
  clubId: string;
  club: { id: string; name: string; slug?: string; logoUrl?: string | null };
  type: string;
  status: string;
  scheduledAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  winnerTeamIndex: number | null;
  isWalkover: boolean;
  notes: string | null;
  court: { id: string; name: string; number: number } | null;
  teams: { teamIndex: number; players: { id: string; name: string; photoUrl: string | null }[] }[];
  scores: { setNumber: number; a: number; b: number }[];
  playerTeamIndex: number;
  won: boolean | null;
  opponents: { id: string; name: string; photoUrl: string | null }[];
  partners: { id: string; name: string; photoUrl: string | null }[];
  ratingChange: number | null;
}

function MatchesInner() {
  const { activeClubId, activeMembership } = useSession();
  const [tab, setTab] = useState<"live" | "upcoming" | "done" | "all" | "history">("upcoming");
  const [rows, setRows] = useState<MatchRow[]>([]);
  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([]);
  const [historyClubs, setHistoryClubs] = useState<{ id: string; name: string }[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [clubFilter, setClubFilter] = useState("ALL");
  const [outcomeFilter, setOutcomeFilter] = useState<"ALL" | "WON" | "LOST">("ALL");
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

  async function loadHistory(p = 1) {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(p), pageSize: "20" });
      if (searchQuery.trim()) qs.set("q", searchQuery.trim());
      if (clubFilter !== "ALL") qs.set("clubId", clubFilter);
      if (outcomeFilter !== "ALL") qs.set("outcome", outcomeFilter);
      const data = await api<{
        items: HistoryRow[];
        total: number;
        pageSize: number;
        clubs: { id: string; name: string }[];
      }>(`/matches/history?${qs.toString()}`);
      setHistoryRows(data.items);
      setHistoryClubs(data.clubs ?? []);
      setTotalPages(Math.max(1, Math.ceil(data.total / data.pageSize)));
      setPage(p);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to load match history", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (tab === "history") {
      void loadHistory(1);
    } else {
      void load(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClubId, tab, clubFilter, outcomeFilter]);

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
              { key: "all", label: "All" },
              { key: "history", label: "My History" }
            ]}
            active={tab}
            onChange={(k) => setTab(k as typeof tab)}
          />
          {canCreate && tab !== "history" && (
            <Button onClick={() => setCreateOpen(true)}>+ New match</Button>
          )}
        </div>
      </div>

      {tab === "history" && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
          <div className="min-w-[200px] flex-1">
            <Input
              placeholder="Search opponents or clubs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void loadHistory(1);
              }}
            />
          </div>
          <div className="w-36">
            <Select
              value={outcomeFilter}
              onChange={(e) => setOutcomeFilter(e.target.value as "ALL" | "WON" | "LOST")}
            >
              <option value="ALL">All Outcomes</option>
              <option value="WON">Wins Only</option>
              <option value="LOST">Losses Only</option>
            </Select>
          </div>
          {historyClubs.length > 0 && (
            <div className="w-44">
              <Select
                value={clubFilter}
                onChange={(e) => setClubFilter(e.target.value)}
              >
                <option value="ALL">All Clubs</option>
                {historyClubs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <Button variant="secondary" onClick={() => void loadHistory(1)}>
            Search
          </Button>
          {(searchQuery || clubFilter !== "ALL" || outcomeFilter !== "ALL") && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearchQuery("");
                setClubFilter("ALL");
                setOutcomeFilter("ALL");
              }}
            >
              Reset
            </Button>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : tab === "history" ? (
        <Card className="divide-y">
          {historyRows.map((m) => {
            const oppNames = m.opponents.map((o) => o.name).join(" & ") || "Opponent";
            const partnerNames = m.partners.map((p) => p.name).join(" & ");
            const myTeam = partnerNames ? `You & ${partnerNames}` : "You";
            const isWin = m.won === true;
            const isLoss = m.won === false;

            return (
              <div key={m.id} className="flex flex-wrap items-center justify-between gap-4 p-4 hover:bg-muted/50 transition-colors">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                      {m.club.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {m.type === "DOUBLES" ? "Doubles" : "Singles"}
                    </span>
                    {m.isWalkover && (
                      <Badge tone="warning">WALKOVER</Badge>
                    )}
                  </div>

                  <div className="text-sm">
                    <span className={isWin ? "font-bold text-foreground" : "text-muted-foreground"}>
                      {myTeam}
                    </span>
                    <span className="mx-2 text-xs text-muted-foreground">vs</span>
                    <span className={isLoss ? "font-bold text-foreground" : "text-muted-foreground"}>
                      {oppNames}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {m.endedAt || m.scheduledAt
                      ? new Date(m.endedAt || m.scheduledAt!).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit"
                        })
                      : "Finished"}
                    {m.court ? ` · #${m.court.number} ${m.court.name}` : ""}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  {m.scores.length > 0 && (
                    <div className="flex items-center gap-1.5 font-mono text-sm tabular-nums">
                      {m.scores.map((s, idx) => {
                        const myScore = m.playerTeamIndex === 0 ? s.a : s.b;
                        const oppScore = m.playerTeamIndex === 0 ? s.b : s.a;
                        const setWon = myScore > oppScore;
                        return (
                          <span
                            key={idx}
                            className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                              setWon
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {myScore}-{oppScore}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {isWin && <Badge tone="success">WON</Badge>}
                  {isLoss && <Badge tone="danger">LOST</Badge>}

                  {m.ratingChange !== null && (
                    <span
                      className={`text-xs font-bold tabular-nums ${
                        m.ratingChange >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {m.ratingChange >= 0 ? `+${m.ratingChange}` : m.ratingChange} pts
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {historyRows.length === 0 && (
            <div className="p-12 text-center text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">No matches found in your history</p>
              <p className="mt-1">
                {searchQuery || clubFilter !== "ALL" || outcomeFilter !== "ALL"
                  ? "Try resetting your search query or filters to see all played matches."
                  : "Matches you play across all clubs will automatically appear here."}
              </p>
            </div>
          )}
        </Card>
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
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => void (tab === "history" ? loadHistory(page - 1) : load(page - 1))}
          >
            ← Prev
          </Button>
          <span className="text-muted-foreground">Page {page} of {totalPages}</span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => void (tab === "history" ? loadHistory(page + 1) : load(page + 1))}
          >
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
  const { toast, node } = useToast();

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
      {node}
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

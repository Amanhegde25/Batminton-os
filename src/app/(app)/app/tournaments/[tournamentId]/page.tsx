"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/session";
import { api } from "@/lib/client";
import { Avatar, Badge, Button, Card, Input, Spinner } from "@/components/ui";
import { Dialog, useToast } from "@/components/ui";

interface TmMatch {
  id: string;
  round: number;
  slot: number;
  playerAId: string | null;
  playerBId: string | null;
  setsText: string | null;
  winnerId: string | null;
  status: string;
}
interface TournamentDetail {
  id: string;
  name: string;
  status: string;
  size: number;
  fee: number;
  winnerUserId: string | null;
  runnerUpUserId: string | null;
  totalRounds: number;
  rounds: { round: number; matches: TmMatch[] }[];
  names: Record<string, string>;
  participants: { userId: string; seed: number | null; user: { id: string; name: string; photoUrl: string | null } }[];
}

function BracketInner() {
  const params = useParams<{ id?: string; tournamentId: string }>();
  const { me, activeClubId, activeMembership } = useSession();
  const tid = params.tournamentId;
  const clubId = params.id || activeClubId || "_";
  const [t, setT] = useState<TournamentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [scoreFor, setScoreFor] = useState<TmMatch | null>(null);
  const [setsText, setSetsText] = useState("21-15, 21-18");
  const { toast, node } = useToast();

  const isStaff = ["OWNER", "ADMIN"].includes(activeMembership?.role ?? "");

  const load = useCallback(async () => {
    if (!tid) return;
    try {
      setT(await api<TournamentDetail>(`/clubs/${clubId}/tournaments/${tid}`));
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to load", "error");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId, tid]);

  useEffect(() => {
    void load();
  }, [load]);

  async function register() {
    setBusy(true);
    try {
      await api(`/clubs/${clubId}/tournaments`, {
        method: "PATCH",
        json: { action: "register", tournamentId: tid }
      });
      toast(t && t.fee > 0 ? `Registered — ₹${(t.fee / 100).toLocaleString("en-IN")} fee charged` : "Registered!");
      void load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Registration failed", "error");
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    setBusy(true);
    try {
      await api(`/clubs/${clubId}/tournaments`, { method: "PATCH", json: { action: "start", tournamentId: tid } });
      toast("Bracket generated!");
      void load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Start failed", "error");
    } finally {
      setBusy(false);
    }
  }

  async function submitScore() {
    if (!scoreFor) return;
    setBusy(true);
    try {
      await api(`/clubs/${clubId}/tournaments`, {
        method: "PATCH",
        json: { action: "score", tournamentId: tid, matchId: scoreFor.id, setsText }
      });
      setScoreFor(null);
      void load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Invalid score format", "error");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }
  if (!t) return null;

  const nameOf = (id: string | null) => (id ? t.names[id] ?? "?" : "—");
  const registered = me ? t.participants.some((p) => p.userId === me.id) : false;
  const roundLabel = (r: number, total: number) =>
    r === total ? "Final" : r === total - 1 ? "Semifinals" : r === total - 2 ? "Quarterfinals" : `Round of ${Math.pow(2, total - r + 1)}`;

  return (
    <div className="space-y-5">
      {node}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/app/tournaments" className="text-sm text-primary hover:underline">
            ← Tournaments
          </Link>
          <h1 className="text-2xl font-bold">{t.name}</h1>
          <p className="text-sm text-muted-foreground">
            Knockout · {t.size} slots{t.fee > 0 ? ` · entry ₹${(t.fee / 100).toLocaleString("en-IN")}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={t.status === "ONGOING" ? "danger" : t.status === "COMPLETED" ? "success" : "primary"}>
            {t.status.toLowerCase()}
          </Badge>
          {t.status === "REGISTRATION" && !registered && !isStaff && (
            <Button onClick={register} disabled={busy}>
              Register ({t.participants.length}/{t.size})
            </Button>
          )}
          {isStaff && t.status === "REGISTRATION" && (
            <Button variant="secondary" onClick={start} disabled={busy || t.participants.length < 2}>
              Generate bracket
            </Button>
          )}
        </div>
      </div>

      {t.winnerUserId && (
        <Card className="p-4 text-center">
          🏆 <b>{nameOf(t.winnerUserId)}</b> wins
          {t.runnerUpUserId ? <> · runner-up {nameOf(t.runnerUpUserId)}</> : null}
        </Card>
      )}

      {t.status === "REGISTRATION" && (
        <Card className="p-5">
          <p className="mb-3 text-sm font-semibold">Registered players ({t.participants.length})</p>
          <div className="flex flex-wrap gap-2">
            {t.participants.map((p) => (
              <span key={p.userId} className="flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-xs">
                <Avatar name={p.user.name} src={p.user.photoUrl} size={22} />
                {p.user.name}
              </span>
            ))}
            {t.participants.length === 0 && <p className="text-xs text-muted-foreground">Nobody yet.</p>}
          </div>
        </Card>
      )}

      {(t.status === "ONGOING" || t.status === "COMPLETED") && (
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-6" style={{ minWidth: t.totalRounds * 240 }}>
            {t.rounds.map((r) => (
              <div key={r.round} className="flex w-56 shrink-0 flex-col justify-around gap-3">
                <p className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {roundLabel(r.round, t.totalRounds)}
                </p>
                {r.matches.map((m) => {
                  const ready = m.playerAId && m.playerBId;
                  return (
                    <button
                      key={m.id}
                      disabled={!ready || m.status === "DONE" || !isStaff}
                      onClick={() => {
                        setScoreFor(m);
                        setSetsText(m.setsText ?? "21-15, 21-18");
                      }}
                      className={`rounded-xl border p-3 text-left text-sm ${ready ? "hover:border-primary/50" : "opacity-60"} ${
                        m.status === "DONE" ? "bg-muted/40" : "bg-card"
                      }`}
                    >
                      {[m.playerAId, m.playerBId].map((pid, side) => (
                        <div
                          key={side ?? `${m.id}-${side}`}
                          className={`flex items-center justify-between py-0.5 ${
                            pid && m.winnerId === pid ? "font-semibold text-emerald-600" : ""
                          }`}
                        >
                          <span className="truncate">{nameOf(pid)}</span>
                          {side === 1 && m.setsText && <span className="ml-2 text-[10px] tabular-nums text-muted-foreground">{m.setsText}</span>}
                        </div>
                      ))}
                      {!ready && <p className="text-[10px] text-muted-foreground">Awaiting players</p>}
                      {ready && m.status !== "DONE" && isStaff && <p className="mt-1 text-[10px] text-primary">Tap to enter score →</p>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={!!scoreFor} onClose={() => setScoreFor(null)} title="Enter match score">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {nameOf(scoreFor?.playerAId ?? null)} vs {nameOf(scoreFor?.playerBId ?? null)}
          </p>
          <Input value={setsText} onChange={(e) => setSetsText(e.target.value)} placeholder="21-15, 21-18" />
          <p className="text-xs text-muted-foreground">Comma-separated sets. Best of 3.</p>
          <Button className="w-full" disabled={busy} onClick={submitScore}>
            Submit & advance winner
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

export default function TournamentDetailPage() {
  return <BracketInner />;
}

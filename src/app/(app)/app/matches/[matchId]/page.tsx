"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/session";
import { api } from "@/lib/client";
import { Avatar, Badge, Button, Card, Input, Spinner } from "@/components/ui";
import { useToast } from "@/components/ui";

interface SetScore {
  setNumber: number;
  a: number;
  b: number;
}
interface MatchDetail {
  id: string;
  type: string;
  status: string;
  winnerTeamIndex: number | null;
  isWalkover: boolean;
  notes: string | null;
  roundLabel: string | null;
  tournamentId: string | null;
  scheduledAt: string;
  court?: { id: string; name: string; number: number } | null;
  teams: { teamIndex: number; players: { id: string; name: string; photoUrl: string | null }[] }[];
  scores: SetScore[];
  ratingChanges: Record<string, number> | null;
}

export default function MatchDetailPage() {
  const params = useParams<{ id: string; matchId: string }>();
  const clubId = params.id;
  const matchId = params.matchId;
  const { activeMembership } = useSession();
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [draftA, setDraftA] = useState("");
  const [draftB, setDraftB] = useState("");
  const { toast, node } = useToast();

  const canControl = ["OWNER", "ADMIN", "COACH"].includes(activeMembership?.role ?? "");

  const load = useCallback(async () => {
    try {
      setMatch(await api<MatchDetail>(`/clubs/${clubId}/matches/${matchId}`));
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to load match", "error");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId, matchId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (match?.status !== "IN_PROGRESS") return;
    const t = setInterval(() => void load(), 15000);
    return () => clearInterval(t);
  }, [match?.status, load]);

  async function act(json: Record<string, unknown>) {
    setBusy(true);
    try {
      await api(`/clubs/${clubId}/matches/${matchId}`, { method: "POST", json });
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Action failed", "error");
      throw err;
    } finally {
      setBusy(false);
    }
  }

  function validateDraft(): { a: number; b: number } | null {
    const a = Number(draftA);
    const b = Number(draftB);
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return null;
    if (a === b) return null;
    const hi = Math.max(a, b);
    const lo = Math.min(a, b);
    if (hi < 21 || hi - lo < 2) return null;
    if (hi > 30) return null;
    if (hi === 30 && lo !== 29) return null;
    return { a, b };
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }
  if (!match) return null;

  const teamName = (idx: number) =>
    match.teams[idx]?.players.map((p) => p.name).join(" & ") || "TBD";
  const setsWon = (idx: number) =>
    match.scores.filter((s) => (s.a > s.b ? 0 : 1) === idx).length;

  async function addSet() {
    const parsed = validateDraft();
    if (!parsed) {
      toast("Invalid badminton score — winner needs ≥21, lead ≥2 (cap 30)", "error");
      return;
    }
    try {
      await act({ action: "score", sets: [...match!.scores.map((s) => ({ a: s.a, b: s.b })), parsed] });
      setDraftA("");
      setDraftB("");
    } catch {}
  }

  async function complete() {
    try {
      await act({ action: "complete" });
      toast("Match completed — ratings and penalties updated");
    } catch {}
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {node}
      <div className="flex items-center justify-between">
        <Link href="/app/matches" className="text-sm text-primary hover:underline">
          ← All matches
        </Link>
        <div className="flex items-center gap-2">
          {match.roundLabel && <Badge tone="accent">{match.roundLabel}</Badge>}
          <Badge tone={match.status === "IN_PROGRESS" ? "danger" : match.status === "COMPLETED" ? "success" : "muted"}>
            {match.status === "IN_PROGRESS" ? "● LIVE" : match.isWalkover ? "WALKOVER" : match.status.toLowerCase()}
          </Badge>
        </div>
      </div>

      <Card className="p-6">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          {[0, 1].map((idx) => (
            <div key={idx} className={idx === 1 ? "order-3 text-right" : ""}>
              <p className={`font-semibold ${match.winnerTeamIndex === idx && match.status !== "SCHEDULED" ? "text-emerald-600" : ""}`}>
                {teamName(idx)} {match.winnerTeamIndex === idx && "🏆"}
              </p>
              <div className={`mt-2 flex gap-1.5 ${idx === 1 ? "justify-end" : ""}`}>
                {match.teams[idx].players.map((p) => (
                  <Avatar key={p.id} name={p.name} src={p.photoUrl} size={30} />
                ))}
              </div>
            </div>
          ))}
          <div className="order-2 text-center">
            <p className="text-3xl font-bold tabular-nums">
              {match.scores.length ? `${setsWon(0)}–${setsWon(1)}` : "vs"}
            </p>
            <p className="text-xs text-muted-foreground capitalize">{match.type.toLowerCase()}</p>
          </div>
        </div>

        {match.scores.length > 0 && (
          <div className="mt-5 flex justify-center gap-2">
            {match.scores.map((s) => (
              <span key={s.setNumber} className="rounded-lg bg-muted px-3 py-1.5 text-sm tabular-nums">
                {s.a}–{s.b}
              </span>
            ))}
          </div>
        )}

        <p className="mt-4 text-center text-xs text-muted-foreground">
          {new Date(match.scheduledAt).toLocaleString()}
          {match.court ? ` · Court #${match.court.number} ${match.court.name}` : ""}
          {match.notes ? ` · ${match.notes}` : ""}
        </p>

        {match.ratingChanges && (
          <div className="mt-4 flex flex-wrap justify-center gap-2 border-t pt-4 text-xs">
            {Object.entries(match.ratingChanges).map(([uid, delta]) => {
              const p = [...match.teams[0].players, ...match.teams[1].players].find((x) => x.id === uid);
              return (
                <span key={uid} className={`rounded-full px-2.5 py-1 ${delta >= 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-500"}`}>
                  {p?.name ?? uid.slice(0, 6)} {delta >= 0 ? "+" : ""}
                  {delta}
                </span>
              );
            })}
          </div>
        )}
      </Card>

      {canControl && ["SCHEDULED", "READY"].includes(match.status) && (
        <Card className="space-y-3 p-5">
          <p className="text-sm font-semibold">Controls</p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => act({ action: "start" }).catch(() => {})}>
              ▶ Start match
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => act({ action: "cancel" }).then(() => toast("Match cancelled")).catch(() => {})}>
              Cancel match
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => act({ action: "walkover", winnerTeamIndex: 0 }).then(() => toast("Walkover recorded")).catch(() => {})}
            >
              Walkover → Team A
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => act({ action: "walkover", winnerTeamIndex: 1 }).then(() => toast("Walkover recorded")).catch(() => {})}
            >
              Walkover → Team B
            </Button>
          </div>
        </Card>
      )}

      {canControl && match.status === "IN_PROGRESS" && (
        <Card className="space-y-3 p-5">
          <p className="text-sm font-semibold">Enter set result</p>
          <div className="flex items-end gap-3">
            <div className="w-24">
              <Input inputMode="numeric" placeholder={teamName(0).split(" ")[0]} value={draftA} onChange={(e) => setDraftA(e.target.value)} />
            </div>
            <span className="pb-2">–</span>
            <div className="w-24">
              <Input inputMode="numeric" placeholder={teamName(1).split(" ")[0]} value={draftB} onChange={(e) => setDraftB(e.target.value)} />
            </div>
            <Button disabled={busy} onClick={addSet}>
              Add set
            </Button>
            <Button variant="destructive" disabled={busy} onClick={() => act({ action: "cancel" }).catch(() => {})}>
              Void
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Rules: win at 21+ with 2-point lead; 29-29 plays to 30.</p>
          <Button className="w-full" disabled={busy} onClick={complete}>
            🏁 Complete match ({setsWon(0)}–{setsWon(1)})
          </Button>
        </Card>
      )}

      {!canControl && match.status === "SCHEDULED" && (
        <p className="text-center text-sm text-muted-foreground">Waiting for staff to start this match.</p>
      )}
    </div>
  );
}

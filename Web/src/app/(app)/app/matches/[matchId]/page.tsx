"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/session";
import { api } from "@/lib/client";
import { Avatar, Badge, Button, Card, Input, Spinner, Dialog } from "@/components/ui";
import { useToast } from "@/components/ui";
import {
  Trophy,
  Flag,
  ShuttlecockIcon,
  RotateCcw,
  ArrowLeftRight,
  Sparkles,
  CheckCircle2,
  Clock,
  Activity,
  ArrowRight
} from "@/components/icons";

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
  const params = useParams<{ id?: string; matchId: string }>();
  const { activeClubId, activeMembership } = useSession();
  const matchId = params.matchId;
  const clubId = params.id || activeClubId || "_";

  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Live Scoring State
  const [liveA, setLiveA] = useState(0);
  const [liveB, setLiveB] = useState(0);
  const [serving, setServing] = useState<0 | 1>(0);
  const [swapped, setSwapped] = useState(false);
  const [scoreHistory, setScoreHistory] = useState<{ a: number; b: number; serving: 0 | 1 }[]>([]);

  // Win condition popup state
  const [winModalOpen, setWinModalOpen] = useState(false);
  const [winInfo, setWinInfo] = useState<{
    setNumber: number;
    winnerIdx: 0 | 1;
    winnerName: string;
    finalA: number;
    finalB: number;
    reason: string;
    isMatchOver: boolean;
  } | null>(null);

  // Manual fallback inputs
  const [manualMode, setManualMode] = useState(false);
  const [draftA, setDraftA] = useState("");
  const [draftB, setDraftB] = useState("");

  const { toast, node } = useToast();
  const canControl = ["OWNER", "ADMIN", "COACH"].includes(activeMembership?.role ?? "");

  const load = useCallback(async () => {
    if (!matchId) return;
    try {
      const data = await api<MatchDetail>(`/clubs/${clubId}/matches/${matchId}`);
      setMatch(data);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to load match", "error");
    } finally {
      setLoading(false);
    }
  }, [clubId, matchId, toast]);

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

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-6 w-6 text-primary" />
      </div>
    );
  }
  if (!match) return null;

  const teamName = (idx: number) =>
    match.teams[idx]?.players.map((p) => p.name).join(" & ") || `Team ${idx === 0 ? "A" : "B"}`;

  const setsWon = (idx: number) =>
    match.scores.filter((s) => (s.a > s.b ? 0 : 1) === idx).length;

  const currentSetNum = match.scores.length + 1;

  // BWF Badminton Win Condition Evaluator
  function evaluateWinCondition(a: number, b: number): { won: boolean; winnerIdx: 0 | 1 | null; reason: string } {
    if (a >= 21 && a - b >= 2) {
      return {
        won: true,
        winnerIdx: 0,
        reason: a === 21 && b < 20 ? "Standard Set Win (21 points, 2+ lead)" : "Deuce Advantage Win (2-point lead)"
      };
    }
    if (b >= 21 && b - a >= 2) {
      return {
        won: true,
        winnerIdx: 1,
        reason: b === 21 && a < 20 ? "Standard Set Win (21 points, 2+ lead)" : "Deuce Advantage Win (2-point lead)"
      };
    }
    if (a >= 30 && a > b) {
      return { won: true, winnerIdx: 0, reason: "Sudden Death Golden Point (Max 30 Cap reached)" };
    }
    if (b >= 30 && b > a) {
      return { won: true, winnerIdx: 1, reason: "Sudden Death Golden Point (Max 30 Cap reached)" };
    }
    return { won: false, winnerIdx: null, reason: "" };
  }

  // Adjust score handler for +1, +2, +3, -1, -2
  function adjustScore(teamIdx: 0 | 1, delta: number) {
    if (busy || match?.status !== "IN_PROGRESS") return;

    // Save history for undo
    setScoreHistory((prev) => [...prev, { a: liveA, b: liveB, serving }]);

    let nextA = liveA;
    let nextB = liveB;

    if (teamIdx === 0) {
      nextA = Math.max(0, Math.min(30, liveA + delta));
      setLiveA(nextA);
      if (delta > 0) setServing(0);
    } else {
      nextB = Math.max(0, Math.min(30, liveB + delta));
      setLiveB(nextB);
      if (delta > 0) setServing(1);
    }

    // Check if win condition met
    const win = evaluateWinCondition(nextA, nextB);
    if (win.won && win.winnerIdx !== null) {
      const winner = win.winnerIdx;
      const previousSetsWonByWinner = setsWon(winner);
      const isMatchOver = previousSetsWonByWinner + 1 >= 2 || currentSetNum >= 3;

      setWinInfo({
        setNumber: currentSetNum,
        winnerIdx: winner,
        winnerName: teamName(winner),
        finalA: nextA,
        finalB: nextB,
        reason: win.reason,
        isMatchOver
      });
      setWinModalOpen(true);
    }
  }

  // Undo point
  function handleUndo() {
    if (scoreHistory.length === 0) return;
    const last = scoreHistory[scoreHistory.length - 1];
    setLiveA(last.a);
    setLiveB(last.b);
    setServing(last.serving);
    setScoreHistory((prev) => prev.slice(0, -1));
  }

  // Advance to next set or complete match from modal
  async function handleConfirmSetWin() {
    if (!winInfo) return;
    const newSets = [...match!.scores.map((s) => ({ a: s.a, b: s.b })), { a: winInfo.finalA, b: winInfo.finalB }];

    try {
      if (winInfo.isMatchOver) {
        await act({ action: "complete", sets: newSets });
        toast(`Match completed! Winner: ${winInfo.winnerName}`);
      } else {
        await act({ action: "score", sets: newSets });
        toast(`Set ${winInfo.setNumber} won by ${winInfo.winnerName}! Starting Set ${winInfo.setNumber + 1}.`);
      }
      setLiveA(0);
      setLiveB(0);
      setScoreHistory([]);
      setWinModalOpen(false);
      setWinInfo(null);
    } catch {}
  }

  // Badminton context message
  function getMatchStatusBanner() {
    if (match?.status !== "IN_PROGRESS") return null;
    const win = evaluateWinCondition(liveA, liveB);
    if (win.won) return null;

    if (liveA === 29 && liveB === 29) {
      return { tone: "destructive", text: "GOLDEN POINT (29-29) — Sudden Death, 30th point wins the set!" };
    }
    if (liveA >= 20 && liveB >= 20 && liveA === liveB) {
      return { tone: "warning", text: `DEUCE (${liveA}-${liveB}) — 2-point clear advantage required to win.` };
    }
    if (liveA >= 20 && liveA > liveB) {
      const isMatchPoint = setsWon(0) === 1 || currentSetNum === 3;
      return {
        tone: "primary",
        text: `${isMatchPoint ? "MATCH POINT" : "GAME POINT"} for ${teamName(0)} (${liveA}-${liveB})`
      };
    }
    if (liveB >= 20 && liveB > liveA) {
      const isMatchPoint = setsWon(1) === 1 || currentSetNum === 3;
      return {
        tone: "primary",
        text: `${isMatchPoint ? "MATCH POINT" : "GAME POINT"} for ${teamName(1)} (${liveB}-${liveA})`
      };
    }
    if (liveA === 11 || liveB === 11) {
      return { tone: "accent", text: "INTERVAL — 11 Points reached (60-second court break & coaching advice allowed)" };
    }
    return null;
  }

  const statusBanner = getMatchStatusBanner();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {node}

      {/* Breadcrumb & Match Status Header */}
      <div className="flex items-center justify-between">
        <Link href="/app/matches" className="text-xs font-semibold text-primary hover:underline">
          ← All Matches
        </Link>
        <div className="flex items-center gap-2">
          {match.roundLabel && <Badge tone="accent">{match.roundLabel}</Badge>}
          <Badge tone={match.status === "IN_PROGRESS" ? "danger" : match.status === "COMPLETED" ? "success" : "muted"}>
            {match.status === "IN_PROGRESS" ? "LIVE ON COURT" : match.isWalkover ? "WALKOVER" : match.status.toLowerCase()}
          </Badge>
        </div>
      </div>

      {/* Main Match Overview Card */}
      <Card className="p-6">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          {/* Team 0 */}
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-base font-bold tracking-tight ${match.winnerTeamIndex === 0 && match.status !== "SCHEDULED" ? "text-primary" : "text-foreground"}`}>
                {teamName(0)}
              </span>
              {match.winnerTeamIndex === 0 && <Trophy className="h-4 w-4 text-amber-500" />}
            </div>
            <div className="mt-2 flex gap-1.5">
              {match.teams[0].players.map((p) => (
                <Avatar key={p.id} name={p.name} src={p.photoUrl} size={32} />
              ))}
            </div>
          </div>

          {/* Sets Won Center */}
          <div className="text-center px-4">
            <p className="font-mono text-3xl font-extrabold tracking-tight text-foreground tabular-nums">
              {match.scores.length > 0 || match.status === "IN_PROGRESS" ? `${setsWon(0)} – ${setsWon(1)}` : "vs"}
            </p>
            <span className="rounded-md border border-border/80 bg-muted/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Best of 3 · {match.type}
            </span>
          </div>

          {/* Team 1 */}
          <div className="text-right">
            <div className="flex items-center justify-end gap-2">
              {match.winnerTeamIndex === 1 && <Trophy className="h-4 w-4 text-amber-500" />}
              <span className={`text-base font-bold tracking-tight ${match.winnerTeamIndex === 1 && match.status !== "SCHEDULED" ? "text-primary" : "text-foreground"}`}>
                {teamName(1)}
              </span>
            </div>
            <div className="mt-2 flex justify-end gap-1.5">
              {match.teams[1].players.map((p) => (
                <Avatar key={p.id} name={p.name} src={p.photoUrl} size={32} />
              ))}
            </div>
          </div>
        </div>

        {/* Completed Sets History Tracker */}
        {match.scores.length > 0 && (
          <div className="mt-5 flex items-center justify-center gap-2 border-t border-border/60 pt-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mr-2">Sets:</span>
            {match.scores.map((s) => (
              <span
                key={s.setNumber}
                className={`rounded-xl border px-3 py-1 font-mono text-xs font-bold tabular-nums ${
                  s.a > s.b
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border/80 bg-muted/40 text-foreground"
                }`}
              >
                Set {s.setNumber}: {s.a} – {s.b}
              </span>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground border-t border-border/40 pt-3">
          <span className="flex items-center gap-1 font-mono">
            <Clock className="h-3.5 w-3.5" />
            {new Date(match.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          {match.court && (
            <span className="font-medium text-foreground">Court #{match.court.number} ({match.court.name})</span>
          )}
          {match.notes && <span>· {match.notes}</span>}
        </div>

        {/* Rating Deltas */}
        {match.ratingChanges && (
          <div className="mt-4 flex flex-wrap justify-center gap-2 border-t border-border/60 pt-4 text-xs">
            {Object.entries(match.ratingChanges).map(([uid, delta]) => {
              const p = [...match.teams[0].players, ...match.teams[1].players].find((x) => x.id === uid);
              return (
                <span
                  key={uid}
                  className={`rounded-full px-3 py-1 font-mono text-xs font-semibold tabular-nums ${
                    delta >= 0 ? "border border-primary/20 bg-primary/10 text-primary" : "border border-destructive/20 bg-destructive/10 text-destructive"
                  }`}
                >
                  {p?.name ?? uid.slice(0, 6)} {delta >= 0 ? "+" : ""}
                  {delta} Elo
                </span>
              );
            })}
          </div>
        )}
      </Card>

      {/* Scheduled Controls */}
      {canControl && ["SCHEDULED", "READY"].includes(match.status) && (
        <Card className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">Court Controls</h2>
            <Badge tone="primary">Match Ready</Badge>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Button disabled={busy} onClick={() => act({ action: "start" }).catch(() => {})}>
              ▶ Start Live Match
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => act({ action: "cancel" }).then(() => toast("Match cancelled")).catch(() => {})}>
              Cancel Match
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => act({ action: "walkover", winnerTeamIndex: 0 }).then(() => toast("Walkover awarded to Team A")).catch(() => {})}
            >
              Walkover → Team A
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => act({ action: "walkover", winnerTeamIndex: 1 }).then(() => toast("Walkover awarded to Team B")).catch(() => {})}
            >
              Walkover → Team B
            </Button>
          </div>
        </Card>
      )}

      {/* LIVE BADMINTON SCORING CONSOLE (per user request) */}
      {canControl && match.status === "IN_PROGRESS" && (
        <Card className="overflow-hidden border border-border/80 bg-card p-6 shadow-md">
          {/* Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
              </span>
              <h2 className="text-base font-bold tracking-tight text-foreground">
                Set {currentSetNum} Live Scoring Console
              </h2>
              <Badge tone="primary">{currentSetNum === 3 ? "DECIDER SET" : `SET ${currentSetNum}`}</Badge>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() => setSwapped(!swapped)}
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
                Swap Sides
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                disabled={scoreHistory.length === 0}
                onClick={handleUndo}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Undo
              </Button>
            </div>
          </div>

          {/* Badminton Dynamic Rule Status Banner */}
          {statusBanner && (
            <div
              className={`mt-4 rounded-xl border p-2.5 text-center text-xs font-semibold tracking-wide ${
                statusBanner.tone === "destructive"
                  ? "border-destructive/40 bg-destructive/10 text-destructive animate-pulse"
                  : statusBanner.tone === "warning"
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-500"
                  : "border-primary/40 bg-primary/10 text-primary"
              }`}
            >
              {statusBanner.text}
            </div>
          )}

          {/* Digital Scoreboard Display */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Team Left Column */}
            {(() => {
              const leftIdx = swapped ? 1 : 0;
              const rightIdx = swapped ? 0 : 1;
              const scoreLeft = swapped ? liveB : liveA;
              const scoreRight = swapped ? liveA : liveB;
              const isServingLeft = serving === leftIdx;
              const isServingRight = serving === rightIdx;

              return (
                <>
                  {/* Left Team Pad */}
                  <div className="flex flex-col justify-between rounded-2xl border border-border/80 bg-muted/20 p-5">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm text-foreground truncate max-w-[200px]">
                          {teamName(leftIdx)}
                        </span>
                        {isServingLeft && (
                          <div className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/15 px-2.5 py-0.5 text-[10px] font-bold text-primary animate-pulse">
                            <ShuttlecockIcon className="h-3 w-3" />
                            <span>SERVING</span>
                          </div>
                        )}
                      </div>

                      {/* Giant Digital Score */}
                      <div className="my-5 flex items-center justify-center">
                        <span className="font-mono text-7xl font-extrabold tracking-tighter text-foreground tabular-nums drop-shadow-sm">
                          {scoreLeft}
                        </span>
                      </div>
                    </div>

                    {/* Point Action Buttons (+1, +2, +3, -1, -2 per badminton rules) */}
                    <div className="space-y-2.5">
                      {/* Primary +1 Rally Button */}
                      <Button
                        className="w-full h-12 text-base font-bold shadow-md hover:brightness-110"
                        onClick={() => adjustScore(leftIdx, 1)}
                      >
                        +1 Rally Point
                      </Button>

                      {/* Quick Tactical Additions */}
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="secondary"
                          className="h-10 text-xs font-semibold"
                          onClick={() => adjustScore(leftIdx, 2)}
                        >
                          +2 Smash
                        </Button>
                        <Button
                          variant="secondary"
                          className="h-10 text-xs font-semibold"
                          onClick={() => adjustScore(leftIdx, 3)}
                        >
                          +3 Run
                        </Button>
                      </div>

                      {/* Corrections */}
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => adjustScore(leftIdx, -1)}
                        >
                          -1 Corr
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => adjustScore(leftIdx, -2)}
                        >
                          -2 Corr
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Right Team Pad */}
                  <div className="flex flex-col justify-between rounded-2xl border border-border/80 bg-muted/20 p-5">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm text-foreground truncate max-w-[200px]">
                          {teamName(rightIdx)}
                        </span>
                        {isServingRight && (
                          <div className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/15 px-2.5 py-0.5 text-[10px] font-bold text-primary animate-pulse">
                            <ShuttlecockIcon className="h-3 w-3" />
                            <span>SERVING</span>
                          </div>
                        )}
                      </div>

                      {/* Giant Digital Score */}
                      <div className="my-5 flex items-center justify-center">
                        <span className="font-mono text-7xl font-extrabold tracking-tighter text-foreground tabular-nums drop-shadow-sm">
                          {scoreRight}
                        </span>
                      </div>
                    </div>

                    {/* Point Action Buttons (+1, +2, +3, -1, -2 per badminton rules) */}
                    <div className="space-y-2.5">
                      {/* Primary +1 Rally Button */}
                      <Button
                        className="w-full h-12 text-base font-bold shadow-md hover:brightness-110"
                        onClick={() => adjustScore(rightIdx, 1)}
                      >
                        +1 Rally Point
                      </Button>

                      {/* Quick Tactical Additions */}
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="secondary"
                          className="h-10 text-xs font-semibold"
                          onClick={() => adjustScore(rightIdx, 2)}
                        >
                          +2 Smash
                        </Button>
                        <Button
                          variant="secondary"
                          className="h-10 text-xs font-semibold"
                          onClick={() => adjustScore(rightIdx, 3)}
                        >
                          +3 Run
                        </Button>
                      </div>

                      {/* Corrections */}
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => adjustScore(rightIdx, -1)}
                        >
                          -1 Corr
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => adjustScore(rightIdx, -2)}
                        >
                          -2 Corr
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>

          {/* Quick manual score set option */}
          <div className="mt-6 flex items-center justify-between border-t border-border/60 pt-4 text-xs">
            <button
              type="button"
              className="text-muted-foreground hover:text-primary underline"
              onClick={() => setManualMode(!manualMode)}
            >
              {manualMode ? "Hide manual entry" : "Manual set input fallback"}
            </button>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => act({ action: "cancel" }).catch(() => {})}
              className="text-destructive hover:bg-destructive/10"
            >
              Void Match
            </Button>
          </div>

          {manualMode && (
            <div className="mt-4 p-4 rounded-xl border border-border/80 bg-muted/20 space-y-3">
              <p className="text-xs font-semibold">Enter custom set score manually</p>
              <div className="flex items-center gap-3">
                <Input
                  className="w-24 font-mono text-center"
                  placeholder="Team A"
                  value={draftA}
                  onChange={(e) => setDraftA(e.target.value)}
                />
                <span className="font-bold">–</span>
                <Input
                  className="w-24 font-mono text-center"
                  placeholder="Team B"
                  value={draftB}
                  onChange={(e) => setDraftB(e.target.value)}
                />
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={async () => {
                    const a = Number(draftA);
                    const b = Number(draftB);
                    if (isNaN(a) || isNaN(b) || a < 0 || b < 0) {
                      toast("Invalid numbers", "error");
                      return;
                    }
                    try {
                      await act({
                        action: "score",
                        sets: [...match.scores.map((s) => ({ a: s.a, b: s.b })), { a, b }]
                      });
                      setDraftA("");
                      setDraftB("");
                      toast(`Set score ${a}-${b} added manually`);
                    } catch {}
                  }}
                >
                  Save Set
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* POPUP ALERT MODAL: Set Win Condition Met (per user request) */}
      <Dialog
        open={winModalOpen}
        onClose={() => setWinModalOpen(false)}
        title={winInfo?.isMatchOver ? "Match Victory Reached!" : `Set ${winInfo?.setNumber} Complete!`}
      >
        {winInfo && (
          <div className="space-y-5 text-center py-2">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary shadow-sm">
              <Trophy className="h-8 w-8 text-amber-500" />
            </div>

            <div>
              <span className="rounded-md border border-primary/20 bg-primary/10 px-3 py-1 font-mono text-xs font-semibold uppercase text-primary">
                {winInfo.isMatchOver ? "Match Final" : `Set ${winInfo.setNumber} Winner`}
              </span>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground">
                {winInfo.winnerName}
              </h2>
              <p className="mt-1 font-mono text-3xl font-extrabold text-primary tabular-nums">
                {winInfo.finalA} – {winInfo.finalB}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">{winInfo.reason}</p>
            </div>

            <div className="rounded-xl border border-border/80 bg-muted/40 p-3.5 text-xs">
              {winInfo.isMatchOver ? (
                <p className="font-semibold text-foreground">
                  {winInfo.winnerName} has won 2 sets and clinched the match victory!
                </p>
              ) : (
                <p className="text-muted-foreground">
                  {winInfo.winnerName} takes Set {winInfo.setNumber}. The next set will commence now.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button
                className="w-full h-12 text-sm font-semibold shadow-md"
                disabled={busy}
                onClick={handleConfirmSetWin}
              >
                {winInfo.isMatchOver ? (
                  <>
                    <Flag className="h-4 w-4 mr-1.5" />
                    Finalize & Complete Match
                  </>
                ) : (
                  <>
                    <span>Start Set {winInfo.setNumber + 1}</span>
                    <ArrowRight className="h-4 w-4 ml-1.5" />
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => {
                  setWinModalOpen(false);
                  handleUndo();
                }}
              >
                Correction / Undo Point
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

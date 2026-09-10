"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/session";
import { api } from "@/lib/client";
import { Avatar, Badge, Button, Card, Spinner } from "@/components/ui";
import { useToast } from "@/components/ui";
import { Sparkles, RefreshCw } from "@/components/icons";

interface SidePlayer {
  id: string;
  name: string;
  rating: number;
  isAbsent?: boolean;
}
interface Assignment {
  court: { id: string; name: string; number: number } | null;
  teamA: SidePlayer[];
  teamB: SidePlayer[];
  explanation: {
    balancePct: number;
    ratingDiff: number;
    partnerRepetition: number;
    opponentRepetition: number;
  };
}
interface QueueItem {
  id: string;
  name: string;
  isAbsent?: boolean;
}
interface Preview {
  assignments: Assignment[];
  queue: (string | QueueItem)[];
  summary: Record<string, unknown> & { reasonIfEmpty?: string };
  availablePlayers: number;
  availableCourts: number;
  allowAbsent?: boolean;
  absentPlayers?: { id: string; name: string; rating: number }[];
  includedAbsentCount?: number;
}
interface SidePlayerWithPhoto extends SidePlayer {
  photoUrl?: string | null;
}

function MatchmakingInner() {
  const { activeClubId, activeMembership } = useSession();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [includeAbsent, setIncludeAbsent] = useState(false);
  const [selectedAbsentIds, setSelectedAbsentIds] = useState<string[]>([]);
  const { toast, node } = useToast();

  const canApply = ["OWNER", "ADMIN", "COACH"].includes(activeMembership?.role ?? "");

  const load = useCallback(
    async (incAbsent = includeAbsent, extraIds = selectedAbsentIds) => {
      if (!activeClubId) return;
      setLoading(true);
      try {
        const qs = new URLSearchParams({ mode: "DOUBLES" });
        if (incAbsent) qs.set("includeAbsent", "true");
        if (extraIds.length > 0) qs.set("extraPlayerIds", extraIds.join(","));
        setPreview(await api<Preview>(`/clubs/${activeClubId}/matchmaking/generate?${qs.toString()}`));
      } catch (err) {
        toast(err instanceof Error ? err.message : "Matchmaking unavailable (PRO feature)", "error");
      } finally {
        setLoading(false);
      }
    },
    [activeClubId, includeAbsent, selectedAbsentIds, toast]
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function apply() {
    setBusy(true);
    try {
      await api(`/clubs/${activeClubId}/matchmaking/generate`, {
        method: "POST",
        json: {
          mode: "DOUBLES",
          apply: true,
          includeAbsent,
          extraPlayerIds: selectedAbsentIds.length > 0 ? selectedAbsentIds : undefined
        }
      });
      toast("Matches scheduled! Check the Matches tab.");
      void load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not apply schedule", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {node}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">AI Matchmaking</h1>
          <p className="text-sm text-muted-foreground">
            Balanced doubles generated from ratings, partner fairness and fatigue.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Regenerate
          </Button>
          {canApply && (
            <Button
              onClick={apply}
              disabled={busy || !preview?.assignments.length}
              className="inline-flex items-center gap-1.5"
            >
              <Sparkles className="h-4 w-4" /> Apply & schedule
            </Button>
          )}
        </div>
      </div>

      {preview && (
        <p className="text-xs text-muted-foreground">
          {preview.availablePlayers} player(s) on court
          {preview.includedAbsentCount ? ` · (${preview.includedAbsentCount} absent included)` : ""} ·{" "}
          {preview.availableCourts} free court(s)
          {preview.queue.length > 0
            ? ` · waiting: ${preview.queue
                .map((q) => (typeof q === "string" ? q : `${q.name}${q.isAbsent ? " (Absent)" : ""}`))
                .join(", ")}`
            : ""}
        </p>
      )}

      {/* Absent Players Controls (When Allowed) */}
      {preview && preview.allowAbsent && (preview.absentPlayers?.length ?? 0) > 0 && (
        <Card className="p-4 space-y-3 bg-muted/20 border-primary/20">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">Add Absent Players</span>
                <Badge tone="primary" className="text-[10px]">Allowed by Club</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Include absent or unregistered members in today&apos;s matchmaking session.
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeAbsent}
                onChange={(e) => {
                  const val = e.target.checked;
                  setIncludeAbsent(val);
                  void load(val, selectedAbsentIds);
                }}
              />
              Include all absent ({preview.absentPlayers?.length ?? 0})
            </label>
          </div>

          {!includeAbsent && (
            <div className="space-y-1.5 pt-1">
              <p className="text-[11px] text-muted-foreground">Or add specific absent members:</p>
              <div className="flex flex-wrap gap-1.5">
                {preview.absentPlayers?.map((ap) => {
                  const selected = selectedAbsentIds.includes(ap.id);
                  return (
                    <button
                      key={ap.id}
                      type="button"
                      onClick={() => {
                        const next = selected
                          ? selectedAbsentIds.filter((id) => id !== ap.id)
                          : [...selectedAbsentIds, ap.id];
                        setSelectedAbsentIds(next);
                        void load(includeAbsent, next);
                      }}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                        selected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background hover:bg-muted text-foreground border-border"
                      }`}
                    >
                      <span>{selected ? "✓" : "+"}</span>
                      <span>{ap.name}</span>
                      <span className="text-[10px] opacity-75">({ap.rating})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      )}

      {preview && !preview.allowAbsent && (
        <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2">
          <span>Only checked-in players are included in AI matchmaking.</span>
          <span className="text-[11px] opacity-80">(Absent players disabled. Club admins can enable in Settings &gt; AI Matchmaking)</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(preview?.assignments ?? []).map((a, i) => (
            <Card key={i} className="space-y-3 p-5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{a.court ? `Court #${a.court.number} · ${a.court.name}` : "No court free"}</span>
                <Badge tone={a.explanation.balancePct >= 85 ? "success" : "warning"}>
                  Balance {Math.round(a.explanation.balancePct)}%
                </Badge>
              </div>
              {[a.teamA, a.teamB].map((team, side) => (
                <div key={side} className={`flex items-center ${side === 1 ? "justify-end" : ""}`}>
                  <div className="flex items-center gap-2">
                    {side === 1 && <span className="mr-2 text-xs text-muted-foreground">vs</span>}
                    {team.map((p) => (
                      <PlayerChip key={p.id} player={p} />
                    ))}
                  </div>
                </div>
              ))}
              <div className="border-t pt-3 text-[11px] text-muted-foreground">
                Rating diff {Math.round(a.explanation.ratingDiff)} · repeat partners ×{a.explanation.partnerRepetition} · repeat
                opponents ×{a.explanation.opponentRepetition}
              </div>
            </Card>
          ))}
          {!loading && (preview?.assignments.length ?? 0) === 0 && (
            <Card className="col-span-full p-10 text-center text-sm text-muted-foreground">
              {(preview?.summary?.reasonIfEmpty as string) ??
                "Not enough players available — need at least 4 for doubles."}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function PlayerChip({ player }: { player: SidePlayer }) {
  const withPhoto = player as SidePlayerWithPhoto;
  return (
    <span className="flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5">
      <Avatar name={player.name} src={withPhoto.photoUrl ?? null} size={26} />
      <span className="text-xs font-medium">{player.name.split(" ")[0]}</span>
      <span className="text-[10px] tabular-nums text-muted-foreground">{player.rating}</span>
      {player.isAbsent && (
        <Badge tone="warning" className="text-[9px] px-1 py-0 ml-0.5">Absent</Badge>
      )}
    </span>
  );
}

export default function MatchmakingPage() {
  return <MatchmakingInner />;
}


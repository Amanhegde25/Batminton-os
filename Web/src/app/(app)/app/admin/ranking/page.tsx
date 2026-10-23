"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "@/components/session";
import { api } from "@/lib/client";
import {
  Badge,
  Button,
  Card,
  Input,
  Spinner,
  Table,
  Td,
  useToast
} from "@/components/ui";
import {
  Trophy,
  Sliders,
  CheckCircle2,
  RotateCcw,
  RefreshCw,
  ExternalLink,
  Medal,
  Award
} from "@/components/icons";
import { DEFAULT_CLUB_POINTS_CONFIG, type ClubPointsConfig, type ClubSettings } from "@/lib/constants";

interface ClubDetailsResponse {
  id: string;
  name: string;
  settings: ClubSettings;
}

interface LeaderboardEntry {
  userId: string;
  name: string;
  photoUrl: string | null;
  value: number;
  display: string;
  meta?: string;
}

export default function ClubAdminRankingPage() {
  const { activeClubId, refresh } = useSession();
  const { toast, node } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pointsConfig, setPointsConfig] = useState<ClubPointsConfig>(DEFAULT_CLUB_POINTS_CONFIG);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  const loadData = useCallback(async () => {
    if (!activeClubId) return;
    setLoading(true);
    try {
      const club = await api<ClubDetailsResponse>(`/clubs/${activeClubId}`);
      const cfg = club.settings?.pointsConfig ?? DEFAULT_CLUB_POINTS_CONFIG;
      setPointsConfig({
        winPoints: typeof cfg.winPoints === "number" ? cfg.winPoints : DEFAULT_CLUB_POINTS_CONFIG.winPoints,
        lossPoints: typeof cfg.lossPoints === "number" ? cfg.lossPoints : DEFAULT_CLUB_POINTS_CONFIG.lossPoints,
        attendancePoints: typeof cfg.attendancePoints === "number" ? cfg.attendancePoints : DEFAULT_CLUB_POINTS_CONFIG.attendancePoints,
        absencePoints: typeof cfg.absencePoints === "number" ? cfg.absencePoints : DEFAULT_CLUB_POINTS_CONFIG.absencePoints
      });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to load club settings", "error");
    } finally {
      setLoading(false);
    }
  }, [activeClubId]);

  const loadLeaderboard = useCallback(async () => {
    if (!activeClubId) return;
    setLoadingLeaderboard(true);
    try {
      const data = await api<LeaderboardEntry[]>(`/clubs/${activeClubId}/leaderboards?category=CLUB_POINTS&period=ALL_TIME`);
      setLeaderboard(data || []);
    } catch {
      setLeaderboard([]);
    } finally {
      setLoadingLeaderboard(false);
    }
  }, [activeClubId]);

  useEffect(() => {
    void loadData();
    void loadLeaderboard();
  }, [loadData, loadLeaderboard]);

  async function handleSave(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!activeClubId) return;

    setSaving(true);
    try {
      await api(`/clubs/${activeClubId}`, {
        method: "PATCH",
        json: {
          settings: {
            pointsConfig
          }
        }
      });
      await refresh();
      toast("Club Ranking Points successfully updated!");
      void loadLeaderboard();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save points configuration", "error");
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setPointsConfig({ ...DEFAULT_CLUB_POINTS_CONFIG });
    toast("Reset point rules to defaults (+1 win, -1 loss, +1 attendance, 0 absence)");
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  const samplePoints =
    8 * pointsConfig.winPoints +
    3 * pointsConfig.lossPoints +
    12 * pointsConfig.attendancePoints +
    1 * pointsConfig.absencePoints;

  return (
    <div className="space-y-6 max-w-4xl">
      {node}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" /> Club Ranking & Points Configuration
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure how players gain or lose Club Points through match outcomes and session attendance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={saving}
            className="gap-1.5 text-xs"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset to Defaults
          </Button>
          <Button
            size="sm"
            onClick={() => void handleSave()}
            disabled={saving}
            className="gap-1.5 text-xs"
          >
            {saving ? <Spinner className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {saving ? "Saving…" : "Save Points Configuration"}
          </Button>
        </div>
      </div>

      {/* 4 Points Inputs Card */}
      <form onSubmit={handleSave} className="space-y-5">
        <Card className="p-5 sm:p-6 space-y-6">
          <div className="border-b border-border/50 pb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <Sliders className="h-4 w-4 text-primary" /> Point Values
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              These points are automatically multiplied against player match wins/losses and attendance logs.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {/* Match Win */}
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  Match Win Points
                </span>
                <Badge tone="success" className="text-[11px] font-mono">
                  {pointsConfig.winPoints >= 0 ? `+${pointsConfig.winPoints}` : pointsConfig.winPoints} pts
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Points awarded to each player on the winning side of a completed match.
              </p>
              <Input
                type="number"
                step="1"
                value={pointsConfig.winPoints}
                onChange={(e) =>
                  setPointsConfig({
                    ...pointsConfig,
                    winPoints: e.target.value === "" ? 0 : Number(e.target.value)
                  })
                }
                className="font-mono text-sm"
              />
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Default: +1 point</span>
                <span>Type: Award</span>
              </div>
            </div>

            {/* Match Loss */}
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-rose-700 dark:text-rose-400">
                  Match Loss Points
                </span>
                <Badge tone="danger" className="text-[11px] font-mono">
                  {pointsConfig.lossPoints >= 0 ? `+${pointsConfig.lossPoints}` : pointsConfig.lossPoints} pts
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Points deducted (or awarded) to players on the losing team of a match.
              </p>
              <Input
                type="number"
                step="1"
                value={pointsConfig.lossPoints}
                onChange={(e) =>
                  setPointsConfig({
                    ...pointsConfig,
                    lossPoints: e.target.value === "" ? 0 : Number(e.target.value)
                  })
                }
                className="font-mono text-sm"
              />
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Default: -1 point</span>
                <span>Type: Deduction</span>
              </div>
            </div>

            {/* Attendance Present */}
            <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                  Attendance / Check-in Points
                </span>
                <Badge tone="primary" className="text-[11px] font-mono">
                  {pointsConfig.attendancePoints >= 0 ? `+${pointsConfig.attendancePoints}` : pointsConfig.attendancePoints} pts
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Points awarded whenever a member checks in or is verified present for a session.
              </p>
              <Input
                type="number"
                step="1"
                value={pointsConfig.attendancePoints}
                onChange={(e) =>
                  setPointsConfig({
                    ...pointsConfig,
                    attendancePoints: e.target.value === "" ? 0 : Number(e.target.value)
                  })
                }
                className="font-mono text-sm"
              />
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Default: +1 point</span>
                <span>Type: Award</span>
              </div>
            </div>

            {/* Absence */}
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                  Failed Attendance / Absence Points
                </span>
                <Badge tone="muted" className="text-[11px] font-mono">
                  {pointsConfig.absencePoints >= 0 ? `+${pointsConfig.absencePoints}` : pointsConfig.absencePoints} pts
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Points applied when a player fails to attend or is recorded absent during nightly sweep.
              </p>
              <Input
                type="number"
                step="1"
                value={pointsConfig.absencePoints}
                onChange={(e) =>
                  setPointsConfig({
                    ...pointsConfig,
                    absencePoints: e.target.value === "" ? 0 : Number(e.target.value)
                  })
                }
                className="font-mono text-sm"
              />
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Default: 0 points</span>
                <span>Type: Absence penalty</span>
              </div>
            </div>
          </div>

          {/* Formula Simulation Card */}
          <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-2.5">
            <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Sliders className="h-3.5 w-3.5 text-primary" /> Live Formula & Ranking Preview
            </h4>
            <p className="text-[11px] text-muted-foreground font-mono">
              Total Points = (Wins × {pointsConfig.winPoints}) + (Losses × {pointsConfig.lossPoints}) + (Attended × {pointsConfig.attendancePoints}) + (Absences × {pointsConfig.absencePoints})
            </p>
            <div className="p-3 rounded-lg bg-background border border-border/40 text-xs">
              <span className="text-muted-foreground">Example Scenario (8 wins, 3 losses, 12 attendances, 1 absence):</span>
              <p className="font-semibold text-foreground mt-1">
                8 × ({pointsConfig.winPoints}) + 3 × ({pointsConfig.lossPoints}) + 12 × ({pointsConfig.attendancePoints}) + 1 × ({pointsConfig.absencePoints}) ={" "}
                <span className="text-primary font-bold text-sm">
                  {samplePoints >= 0 ? `+${samplePoints}` : samplePoints} Club Points
                </span>
              </p>
            </div>
          </div>
        </Card>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={saving}
            className="gap-1.5 text-xs"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset to Defaults
          </Button>
          <Button type="submit" disabled={saving} className="gap-1.5 text-xs">
            {saving ? <Spinner className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {saving ? "Saving…" : "Save Points Configuration"}
          </Button>
        </div>
      </form>

      {/* Live Current Club Ranking Table */}
      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <Award className="h-4 w-4 text-primary" /> Current Club Rankings
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Current member rankings calculated based on official club points.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadLeaderboard}
              disabled={loadingLeaderboard}
              className="h-7 text-xs gap-1.5"
            >
              <RefreshCw className="h-3 w-3" /> Refresh
            </Button>
            <Link href="/app/leaderboards">
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                <ExternalLink className="h-3 w-3" /> View Full Leaderboard
              </Button>
            </Link>
          </div>
        </div>

        {loadingLeaderboard ? (
          <div className="py-12 flex justify-center">
            <Spinner className="h-6 w-6 text-primary" />
          </div>
        ) : (
          <Table head={["Rank", "Player", "Breakdown", "Club Points"]}>
            {leaderboard.map((entry, idx) => (
              <tr key={entry.userId} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                <Td className="w-12 font-bold text-center">
                  {idx === 0 ? (
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-xs">
                      <Medal className="h-3.5 w-3.5" />
                    </span>
                  ) : idx === 1 ? (
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-400/20 text-slate-600 dark:text-slate-300 text-xs">
                      <Medal className="h-3.5 w-3.5" />
                    </span>
                  ) : idx === 2 ? (
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-700/15 text-amber-700 dark:text-amber-500 text-xs">
                      <Medal className="h-3.5 w-3.5" />
                    </span>
                  ) : (
                    `#${idx + 1}`
                  )}
                </Td>
                <Td>
                  <span className="font-semibold text-xs text-foreground">{entry.name}</span>
                </Td>
                <Td className="text-xs text-muted-foreground font-mono">
                  {entry.meta || "—"}
                </Td>
                <Td>
                  <Badge tone={idx === 0 ? "primary" : "muted"} className="font-mono text-xs tabular-nums">
                    {entry.display}
                  </Badge>
                </Td>
              </tr>
            ))}
            {leaderboard.length === 0 && (
              <tr>
                <Td colSpan={4} className="py-12 text-center text-xs text-muted-foreground">
                  No active rankings found yet. Matches and session attendances will appear here automatically.
                </Td>
              </tr>
            )}
          </Table>
        )}
      </Card>
    </div>
  );
}

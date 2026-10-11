"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/session";
import { api } from "@/lib/client";
import { Badge, Button, Card, Select, Spinner, useToast } from "@/components/ui";
import { Brain, Lock, RefreshCw, Award, ArrowRight } from "@/components/icons";

interface Insight {
  headline: string;
  focusAreas: string[];
  drills: string[];
  summary: string;
  confidence: number;
}

interface CoachingPayload extends Insight {
  provider: string;
  generatedAt: string;
  cached: boolean;
}

export default function AICoachingPage() {
  const { me, activeClubId, activeMembership } = useSession();
  const [data, setData] = useState<CoachingPayload | null>(null);
  const [target, setTarget] = useState("");
  const [players, setPlayers] = useState<{ userId: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState<string | null>(null);
  const { toast, node } = useToast();

  const isStaffOrCoach = ["OWNER", "ADMIN", "COACH"].includes(activeMembership?.role ?? "");

  const load = useCallback(
    async (userId?: string) => {
      if (!activeClubId || !me) return;
      setLoading(true);
      try {
        const res = await api<CoachingPayload>(
          `/clubs/${activeClubId}/coaching${userId ? `?userId=${userId}` : ""}`
        );
        setData(res);
        setLocked(null);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed";
        if (msg.includes("upgraded") || msg.includes("FEATURE")) {
          setLocked("This feature is currently unavailable.");
        } else {
          toast(msg, "error");
        }
      } finally {
        setLoading(false);
      }
    },
    [activeClubId, me]
  );

  useEffect(() => {
    void load(target || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClubId]);

  useEffect(() => {
    if (!isStaffOrCoach || !activeClubId) return;
    void api<{ userId: string; name: string }[]>(`/clubs/${activeClubId}/members?status=ACTIVE`)
      .then(setPlayers)
      .catch(() => {});
  }, [isStaffOrCoach, activeClubId]);

  async function regenerate() {
    setBusy(true);
    try {
      await api(`/clubs/${activeClubId}/coaching`, { method: "POST" });
      toast("Fresh AI insights generated");
      void load(target || undefined);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Regeneration failed", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {node}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Brain className="h-6 w-6 text-primary" /> AI Coaching Intelligence
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Weekly algorithmic coaching insights and training drills generated from your real match history.
          </p>
        </div>
        <Button onClick={regenerate} disabled={busy || loading} size="sm" className="inline-flex items-center gap-1.5 text-xs">
          <RefreshCw className={`h-3.5 w-3.5 ${busy || loading ? "animate-spin" : ""}`} /> Regenerate
        </Button>
      </div>

      {/* Cross-link to human coaching */}
      <Card className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-muted/30 border-border/70">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Award className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-foreground">Looking for 1-on-1 Personal Training?</h4>
            <p className="text-[11px] text-muted-foreground">
              Book professional club coaches, pick available days, and choose your preferred time slots.
            </p>
          </div>
        </div>
        <Link href="/app/coaching" className="shrink-0">
          <Button variant="outline" size="sm" className="gap-1 text-xs w-full sm:w-auto">
            Book Club Coach <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      </Card>

      {isStaffOrCoach && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Analyse player:</span>
          <Select
            value={target}
            onChange={(e) => {
              const v = e.target.value;
              setTarget(v);
              void load(v || undefined);
            }}
            className="max-w-xs h-8 text-xs"
          >
            <option value="">Myself</option>
            {players.map((p) => (
              <option key={p.userId} value={p.userId}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      {locked && (
        <Card className="flex flex-col items-center justify-center p-10 text-center text-xs text-muted-foreground">
          <Lock className="mb-2 h-6 w-6 text-muted-foreground/80" />
          {locked}
        </Card>
      )}

      {loading && !data ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : data ? (
        <>
          <Card className="space-y-5 p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3 border-b border-border/50 pb-4">
              <div>
                <h2 className="text-lg font-bold text-foreground">{data.headline}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[11px] font-mono text-muted-foreground">
                    Engine: {data.provider}
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground">·</span>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    Confidence {(data.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
              <Badge tone="primary" className="text-xs">
                {data.cached ? "Cached" : "Fresh"}
              </Badge>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="rounded-xl bg-muted/20 p-4 border border-border/40">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-primary">
                  Identified Focus Areas
                </p>
                <ul className="list-inside list-disc space-y-1.5 text-xs text-foreground">
                  {data.focusAreas.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl bg-muted/20 p-4 border border-border/40">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-primary">
                  Recommended Drills
                </p>
                <ul className="list-inside list-disc space-y-1.5 text-xs text-foreground">
                  {data.drills.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="border-t border-border/50 pt-4">
              <p className="text-xs font-semibold text-foreground mb-1">Analytical Summary</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{data.summary}</p>
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground border-t border-border/40 pt-3">
              <span>Model generated</span>
              <span>{new Date(data.generatedAt).toLocaleString()}</span>
            </div>
          </Card>

          <p className="text-center text-[11px] text-muted-foreground">
            Algorithmically generated suggestions based on match history — not certified medical or physiotherapy advice.
          </p>
        </>
      ) : null}
    </div>
  );
}

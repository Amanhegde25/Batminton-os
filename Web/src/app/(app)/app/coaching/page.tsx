"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/session";
import { api } from "@/lib/client";
import { Badge, Button, Card, Select, Spinner } from "@/components/ui";
import { useToast } from "@/components/ui";
import { Brain, Lock, RefreshCw } from "@/components/icons";

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

function CoachingInner() {
  const { me, activeClubId, activeMembership } = useSession();
  const [data, setData] = useState<CoachingPayload | null>(null);
  const [target, setTarget] = useState("");
  const [players, setPlayers] = useState<{ userId: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState<string | null>(null);
  const { toast, node } = useToast();

  const isCoach = ["OWNER", "ADMIN", "COACH"].includes(activeMembership?.role ?? "");

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
        if (msg.includes("upgraded") || msg.includes("FEATURE")) setLocked("This feature is currently unavailable.");
        else toast(msg, "error");
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
    if (!isCoach || !activeClubId) return;
    void api<{ userId: string; name: string }[]>(`/clubs/${activeClubId}/members?status=ACTIVE`)
      .then(setPlayers)
      .catch(() => {});
  }, [isCoach, activeClubId]);

  async function regenerate() {
    setBusy(true);
    try {
      await api(`/clubs/${activeClubId}/coaching`, { method: "POST" });
      toast("Fresh insights generated");
      void load(target || undefined);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Regeneration failed", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {node}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Brain className="h-6 w-6 text-primary" /> AI Coaching
          </h1>
          <p className="text-sm text-muted-foreground">Weekly insights built from your real match and attendance data.</p>
        </div>
        <Button onClick={regenerate} disabled={busy || loading} className="inline-flex items-center gap-1.5">
          <RefreshCw className={`h-4 w-4 ${busy || loading ? "animate-spin" : ""}`} /> Regenerate
        </Button>
      </div>

      {isCoach && (
        <Select
          value={target}
          onChange={(e) => {
            const v = e.target.value;
            setTarget(v);
            void load(v || undefined);
          }}
          className="max-w-xs"
        >
          <option value="">Myself</option>
          {players.map((p) => (
            <option key={p.userId} value={p.userId}>
              {p.name}
            </option>
          ))}
        </Select>
      )}

      {locked && (
        <Card className="flex flex-col items-center justify-center p-10 text-center text-sm text-muted-foreground">
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
          <Card className="space-y-4 p-6">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold">{data.headline}</h2>
              <Badge tone="primary">
                {data.provider} · {data.cached ? "cached" : "fresh"}
              </Badge>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-semibold text-muted-foreground">Focus areas</p>
                <ul className="list-inside list-disc space-y-1.5 text-sm">
                  {data.focusAreas.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold text-muted-foreground">Suggested drills</p>
                <ul className="list-inside list-disc space-y-1.5 text-sm">
                  {data.drills.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
            </div>

            <p className="border-t pt-4 text-sm text-muted-foreground">{data.summary}</p>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Confidence {(data.confidence * 100).toFixed(0)}%</span>
              <span>{new Date(data.generatedAt).toLocaleString()}</span>
            </div>
          </Card>
          <p className="text-center text-xs text-muted-foreground">
            Generated by a rule-based engine over your last 90 days of matches — not medical or professional advice.
          </p>
        </>
      ) : null}
    </div>
  );
}

export default function CoachingPage() {
  return <CoachingInner />;
}

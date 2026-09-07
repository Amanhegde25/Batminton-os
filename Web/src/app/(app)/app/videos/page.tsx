"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "@/components/session";
import { api } from "@/lib/client";
import { Badge, Button, Card, Spinner } from "@/components/ui";
import { EmptyState } from "@/components/ui";
import { useToast } from "@/components/ui";
import { Video, Lock, Plus, Lightbulb } from "@/components/icons";

interface VideoRow {
  id: string;
  fileName: string;
  status: string;
  durationSeconds: number | null;
  createdAt: string;
  userId?: string;
}
interface AnalysisResult {
  footworkScore: number;
  shotAccuracy: number;
  courtCoverage: number;
  smashSpeedKmh: number;
  rallyCount: number;
  insights: string[];
}

const STATUS_TONE: Record<string, "muted" | "warning" | "success" | "danger"> = {
  PENDING: "muted",
  PROCESSING: "warning",
  COMPLETED: "success",
  FAILED: "danger"
};

function VideosInner() {
  const { activeClubId } = useSession();
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [detail, setDetail] = useState<Record<string, AnalysisResult>>({});
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast, node } = useToast();

  const load = useCallback(async () => {
    if (!activeClubId) return;
    try {
      setVideos(await api<VideoRow[]>(`/clubs/${activeClubId}/videos`));
      setLocked(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("upgraded") || msg.includes("FEATURE")) setLocked(true);
      else toast(msg || "Failed to load videos", "error");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClubId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const pending = videos.filter((v) => v.status === "PROCESSING" || v.status === "PENDING");
    if (!pending.length) return;
    const t = setInterval(async () => {
      for (const v of pending) {
        try {
          const d = await api<{ status: string; analysis: AnalysisResult | null }>(`/clubs/${activeClubId}/videos/${v.id}`);
          if (d.status === "COMPLETED" && d.analysis) {
            setDetail((prev) => ({ ...prev, [v.id]: d.analysis! }));
            void load();
          }
        } catch {}
      }
    }, 3000);
    return () => clearInterval(t);
  }, [videos, activeClubId, load]);

  async function upload(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      await api(`/clubs/${activeClubId}/videos`, { method: "POST", body: form });
      toast("Uploaded — analysis running");
      void load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Upload failed", "error");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function open(v: VideoRow) {
    if (detail[v.id] || v.status !== "COMPLETED") return;
    try {
      const d = await api<{ analysis: AnalysisResult | null }>(`/clubs/${activeClubId}/videos/${v.id}`);
      if (d.analysis) setDetail((prev) => ({ ...prev, [v.id]: d.analysis! }));
    } catch {}
  }

  if (locked) {
    return (
      <EmptyState
        icon={<Lock className="h-8 w-8 text-muted-foreground/80" />}
        title="Video analysis is currently unavailable"
        body="This feature is not accessible right now. Please try again later."
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {node}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Video className="h-6 w-6 text-primary" /> Video Analysis
          </h1>
          <p className="text-sm text-muted-foreground">Upload rally footage — get pose-based insights on form and coverage.</p>
        </div>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="video/mp4,video/webp,video/quicktime,video/webm"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
          <Button onClick={() => fileRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-1.5">
            <Plus className="h-4 w-4" />
            {uploading ? "Uploading…" : "Upload video"}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-3">
          {videos.map((v) => (
            <Card key={v.id} className="p-4">
              <button className="flex w-full items-center justify-between gap-3 text-left" onClick={() => void open(v)}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{v.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(v.createdAt).toLocaleString()}
                    {v.durationSeconds ? ` · ${Math.round(v.durationSeconds)}s` : ""}
                  </p>
                </div>
                <Badge tone={STATUS_TONE[v.status] ?? "muted"}>{v.status.toLowerCase()}</Badge>
              </button>

              {detail[v.id] && (
                <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-4 sm:grid-cols-4">
                  <Metric label="Footwork" value={detail[v.id].footworkScore} />
                  <Metric label="Shot accuracy" value={detail[v.id].shotAccuracy} />
                  <Metric label="Court coverage" value={detail[v.id].courtCoverage} />
                  <Metric label="Smash speed" value={Math.round(detail[v.id].smashSpeedKmh)} suffix="km/h" />
                  <div className="col-span-full mt-1 space-y-1 text-sm">
                    {(detail[v.id].insights ?? []).map((ins, i) => (
                      <p key={i} className="flex items-start gap-2">
                        <Lightbulb className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                        <span>{ins}</span>
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          ))}
          {!loading && videos.length === 0 && (
            <EmptyState title="No videos yet" body="Upload an MP4 of a rally to get your first analysis." />
          )}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-xl bg-muted p-3 text-center">
      <p className="text-lg font-bold tabular-nums">
        {value}
        {suffix ? <span className="text-xs font-normal"> {suffix}</span> : "%"}
      </p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

export default function VideosPage() {
  return <VideosInner />;
}

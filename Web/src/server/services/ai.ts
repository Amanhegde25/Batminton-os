import { aiInsights, videoAnalyses } from "@/server/db";
import { ApiError } from "@/lib/api";
import { cuid } from "@/lib/id";
import { getStorage } from "@/server/providers/storage";
import { getQueue } from "@/server/providers/queue";
import { buildCoachingContext, getAIProvider, type CoachingPayload } from "@/server/providers/ai";
import type { SessionUser } from "@/server/auth/types";

export async function getCoaching(clubId: string, targetUserId: string): Promise<CoachingPayload & { provider: string; generatedAt: string; cached: boolean }> {
  const cached = await aiInsights().findOne({
    clubId,
    userId: targetUserId,
    kind: "COACHING",
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }]
  }, { sort: { createdAt: -1 } });
  if (cached) {
    return { ...(JSON.parse(cached.payload as string) as CoachingPayload), provider: cached.provider as string, generatedAt: (cached.createdAt as Date).toISOString(), cached: true };
  }
  return generateAndStore(clubId, targetUserId);
}

export async function regenerateCoaching(clubId: string, targetUserId: string) {
  await aiInsights().updateMany(
    { clubId, userId: targetUserId, kind: "COACHING" },
    { $set: { expiresAt: new Date() } }
  );
  return generateAndStore(clubId, targetUserId);
}

async function generateAndStore(clubId: string, userId: string) {
  const ctx = await buildCoachingContext(clubId, userId);
  const provider = getAIProvider();
  const payload = await provider.coachingInsights(ctx);
  await aiInsights().insertOne({
    id: cuid(),
    clubId,
    userId,
    kind: "COACHING",
    provider: provider.name,
    payload: JSON.stringify(payload),
    expiresAt: new Date(Date.now() + 12 * 3600 * 1000),
    createdAt: new Date()
  });
  return { ...payload, provider: provider.name, generatedAt: new Date().toISOString(), cached: false };
}

const ALLOWED_VIDEO_MIME = ["video/mp4", "video/webm", "video/quicktime"];
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

export async function uploadVideo(
  clubId: string,
  user: SessionUser,
  file: { buffer: Buffer; originalname: string; mimetype: string }
) {
  if (!ALLOWED_VIDEO_MIME.includes(file.mimetype)) {
    throw ApiError.badRequest("Only MP4, WebM or MOV videos are accepted");
  }
  if (file.buffer.length > MAX_VIDEO_BYTES) {
    throw ApiError.badRequest("Video exceeds the 200MB limit");
  }
  const ext = file.originalname.includes(".") ? file.originalname.split(".").pop()!.toLowerCase() : "mp4";
  const storage = getStorage();
  const key = `videos/${clubId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await storage.put(key, file.buffer, file.mimetype);
  const record = {
    id: cuid(),
    clubId,
    userId: user.id,
    storageKey: key,
    originalName: file.originalname.slice(0, 120),
    mimeType: file.mimetype,
    sizeBytes: file.buffer.length,
    status: "PENDING",
    createdAt: new Date(),
    updatedAt: new Date()
  };
  await videoAnalyses().insertOne(record);
  getQueue().enqueue(`video-analysis:${record.id}`, () => processAnalysis(record.id));
  return record;
}

async function processAnalysis(id: string): Promise<void> {
  try {
    const video = await videoAnalyses().findOne({ id });
    await videoAnalyses().updateOne({ id }, { $set: { status: "PROCESSING", updatedAt: new Date() } });
    await sleep(2500);
    // Seed using file fingerprint (filename + size) so identical videos yield identical, deterministic results
    const seedKey = video ? `${video.originalName}:${video.sizeBytes ?? 0}` : id;
    const result = mockCvResult(seedKey);
    await videoAnalyses().updateOne(
      { id },
      { $set: { status: "COMPLETED", result: JSON.stringify(result), completedAt: new Date(), updatedAt: new Date() } }
    );
  } catch (e) {
    await videoAnalyses()
      .updateOne({ id }, { $set: { status: "FAILED", error: e instanceof Error ? e.message : "processing failed", updatedAt: new Date() } })
      .catch(() => {});
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function mockCvResult(id: string) {
  const seed = hash(id);
  const r = (min: number, max: number) => min + (seed % 1000) / 1000 * (max - min) + ((seed >> 3) % 97) / 97 * 2;
  const rallies = Math.round(r(12, 34));
  const footwork = Math.round(r(62, 94));
  const accuracy = Math.round(r(58, 91));
  const coverage = Math.round(r(60, 95));
  const smashSpeed = Math.round(r(185, 295));
  return {
    pipeline: "mock-cv-v1",
    note: "Simulated computer-vision output. Configure a real CV/AI provider to replace this stage — see docs/ARCHITECTURE.md.",
    footworkScore: footwork,
    shotAccuracy: accuracy,
    courtCoverage: coverage,
    smashSpeedKmh: smashSpeed,
    rallyCount: rallies,
    insights: [
      `Maintained ${footwork}% footwork balance with strong base positioning during rallies.`,
      `Court coverage was optimal in mid-court (${coverage}% coverage efficiency).`,
      `Smash speed peaked around ${smashSpeed} km/h with consistent overhead mechanics.`
    ],
    metrics: {
      ralliesDetected: rallies,
      avgRallyDurationSec: Math.round(r(4.5, 11.2) * 10) / 10,
      smashFrequencyPerRally: Math.round(r(1.1, 3.6) * 10) / 10,
      unforcedErrors: Math.round(r(3, 14)),
      netPlayPct: Math.round(r(18, 42)),
      defensiveRecoveryPct: Math.round(r(48, 82)),
      movementEfficiencyPct: Math.round(r(55, 88)),
      courtCoverageZones: {
        frontCourt: Math.round(r(20, 35)),
        midCourt: Math.round(r(38, 52)),
        rearCourt: Math.round(r(22, 38))
      }
    },
    shotDistribution: {
      clear: Math.round(r(10, 25)),
      drop: Math.round(r(8, 20)),
      smash: Math.round(r(12, 30)),
      drive: Math.round(r(8, 18)),
      lift: Math.round(r(8, 16)),
      netShot: Math.round(r(8, 15))
    }
  };
}

export async function listVideos(clubId: string, user: SessionUser, staffView: boolean) {
  const query: Record<string, unknown> = { clubId };
  if (!staffView) query.userId = user.id;
  return videoAnalyses().find(query).sort({ createdAt: -1 }).limit(50).toArray();
}

export async function getVideo(clubId: string, id: string) {
  const v = await videoAnalyses().findOne({ id, clubId });
  if (!v) throw ApiError.notFound("Video not found");
  let result: unknown = null;
  try {
    result = v.result ? JSON.parse(v.result as string) : null;
  } catch {}
  return { ...v, result };
}

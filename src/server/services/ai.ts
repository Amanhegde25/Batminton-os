import { prisma } from "@/server/db";
import { ApiError } from "@/lib/api";
import { getStorage } from "@/server/providers/storage";
import { getQueue } from "@/server/providers/queue";
import { buildCoachingContext, getAIProvider, type CoachingPayload } from "@/server/providers/ai";
import type { SessionUser } from "@/server/auth/types";

export async function getCoaching(clubId: string, targetUserId: string): Promise<CoachingPayload & { provider: string; generatedAt: string; cached: boolean }> {
  const cached = await prisma.aIInsight.findFirst({
    where: {
      clubId,
      userId: targetUserId,
      kind: "COACHING",
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
    },
    orderBy: { createdAt: "desc" }
  });
  if (cached) {
    return { ...(JSON.parse(cached.payload) as CoachingPayload), provider: cached.provider, generatedAt: cached.createdAt.toISOString(), cached: true };
  }
  return generateAndStore(clubId, targetUserId);
}

export async function regenerateCoaching(clubId: string, targetUserId: string) {
  await prisma.aIInsight.updateMany({
    where: { clubId, userId: targetUserId, kind: "COACHING" },
    data: { expiresAt: new Date() }
  });
  return generateAndStore(clubId, targetUserId);
}

async function generateAndStore(clubId: string, userId: string) {
  const ctx = await buildCoachingContext(clubId, userId);
  const provider = getAIProvider();
  const payload = await provider.coachingInsights(ctx);
  await prisma.aIInsight.create({
    data: {
      clubId,
      userId,
      kind: "COACHING",
      provider: provider.name,
      payload: JSON.stringify(payload),
      expiresAt: new Date(Date.now() + 12 * 3600 * 1000)
    }
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
  const record = await prisma.videoAnalysis.create({
    data: {
      clubId,
      userId: user.id,
      storageKey: key,
      originalName: file.originalname.slice(0, 120),
      mimeType: file.mimetype,
      sizeBytes: file.buffer.length,
      status: "PENDING"
    }
  });
  getQueue().enqueue(`video-analysis:${record.id}`, () => processAnalysis(record.id));
  return record;
}

async function processAnalysis(id: string): Promise<void> {
  try {
    await prisma.videoAnalysis.update({ where: { id }, data: { status: "PROCESSING" } });
    await sleep(2500);
    const result = mockCvResult(id);
    await prisma.videoAnalysis.update({
      where: { id },
      data: { status: "COMPLETED", result: JSON.stringify(result), completedAt: new Date() }
    });
  } catch (e) {
    await prisma.videoAnalysis
      .update({ where: { id }, data: { status: "FAILED", error: e instanceof Error ? e.message : "processing failed" } })
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
  return prisma.videoAnalysis.findMany({
    where: { clubId, ...(staffView ? {} : { userId: user.id }) },
    orderBy: { createdAt: "desc" },
    take: 50
  });
}

export async function getVideo(clubId: string, id: string) {
  const v = await prisma.videoAnalysis.findFirst({ where: { id, clubId } });
  if (!v) throw ApiError.notFound("Video not found");
  let result: unknown = null;
  try {
    result = v.result ? JSON.parse(v.result) : null;
  } catch {}
  return { ...v, result };
}

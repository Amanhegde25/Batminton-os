import { describe, expect, it } from "vitest";
import { prisma } from "../src/server/db";
import { listMembers } from "../src/server/services/members";
import { rosterForDay, monthMatrix } from "../src/server/services/attendance";

describe("Fixed feature regression tests", () => {
  it("listMembers returns flattened fields and filters correctly", async () => {
    const club = await prisma.club.findFirst();
    if (!club) return;

    const allMembers = await listMembers(club.id);
    expect(Array.isArray(allMembers)).toBe(true);
    expect(allMembers.length).toBeGreaterThan(0);

    const first = allMembers[0];
    expect(first).toHaveProperty("userId");
    expect(first).toHaveProperty("name");
    expect(first).toHaveProperty("email");
    expect(first).toHaveProperty("balance");
    expect(typeof first.userId).toBe("string");
    expect(typeof first.name).toBe("string");

    const activeMembers = await listMembers(club.id, undefined, "ACTIVE");
    expect(activeMembers.every((m) => m.status === "ACTIVE")).toBe(true);
  });

  it("rosterForDay returns both roster and flattened rows", async () => {
    const club = await prisma.club.findFirst();
    if (!club) return;

    const res = await rosterForDay(club.id);
    expect(res).toHaveProperty("roster");
    expect(res).toHaveProperty("rows");
    expect(Array.isArray(res.rows)).toBe(true);
    if (res.rows.length > 0) {
      expect(res.rows[0]).toHaveProperty("userId");
      expect(res.rows[0]).toHaveProperty("name");
      expect(res.rows[0]).toHaveProperty("status");
    }
  });

  it("monthMatrix returns array of day strings and member rows", async () => {
    const club = await prisma.club.findFirst();
    if (!club) return;

    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const matrix = await monthMatrix(club.id, monthStr);

    expect(Array.isArray(matrix.days)).toBe(true);
    expect(matrix.days.length).toBeGreaterThanOrEqual(28);
    expect(matrix.days[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    expect(Array.isArray(matrix.rows)).toBe(true);
    if (matrix.rows.length > 0) {
      expect(matrix.rows[0]).toHaveProperty("userId");
      expect(matrix.rows[0]).toHaveProperty("name");
      expect(Array.isArray(matrix.rows[0].cells)).toBe(true);
      expect(matrix.rows[0].cells.length).toBe(matrix.days.length);
    }
  });

  it("mockCvResult produces expected analytics metrics and insights", async () => {
    const { uploadVideo, getVideo } = await import("../src/server/services/ai");
    const user = await prisma.user.findFirst();
    const club = await prisma.club.findFirst();
    if (!user || !club) return;

    const sampleBuffer = Buffer.from("dummy video content");
    const uploaded = await uploadVideo(club.id, { id: user.id } as any, {
      buffer: sampleBuffer,
      originalname: "test-rally.mp4",
      mimetype: "video/mp4"
    });

    expect(uploaded.id).toBeDefined();
    await new Promise((r) => setTimeout(r, 3000));

    const video = await getVideo(club.id, uploaded.id);
    expect(video.status).toBe("COMPLETED");
    const result = video.result as any;
    expect(result).toHaveProperty("footworkScore");
    expect(result).toHaveProperty("shotAccuracy");
    expect(result).toHaveProperty("courtCoverage");
    expect(result).toHaveProperty("smashSpeedKmh");
    expect(result).toHaveProperty("insights");
    expect(Array.isArray(result.insights)).toBe(true);
    expect(result.insights.length).toBeGreaterThan(0);
  });
});

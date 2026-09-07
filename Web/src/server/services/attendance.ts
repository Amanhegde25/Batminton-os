import { prisma } from "@/server/db";
import { ApiError } from "@/lib/api";
import { AUDIT_ACTIONS, parseClubSettings } from "@/lib/constants";
import { attendanceStatusForCheckIn } from "@/lib/engines/attendance-rules";
import { dayKey, startOfDay, endOfDay } from "@/lib/date";
import { signToken, verifyToken } from "@/server/auth/tokens";
import { issueFromEvent } from "./penalties";
import { audit } from "./audit";

export async function checkIn(
  clubId: string,
  targetUserId: string,
  input: { method: "MANUAL" | "QR" | "GPS"; token?: string; lat?: number; lng?: number },
  actor: { id: string }
) {
  const club = await prisma.club.findFirst({ where: { id: clubId, deletedAt: null } });
  if (!club) throw ApiError.notFound("Club not found");
  const settings = parseClubSettings(club.settings);

  const membership = await prisma.clubMember.findUnique({
    where: { clubId_userId: { clubId, userId: targetUserId } }
  });
  if (!membership || membership.status !== "ACTIVE") {
    throw ApiError.forbidden("Only active members can check in");
  }

  const isStaffActor = await prisma.clubMember.findFirst({
    where: { clubId, userId: actor.id, status: "ACTIVE", role: { in: ["OWNER", "ADMIN"] } }
  });
  if (targetUserId !== actor.id && !isStaffActor) {
    throw ApiError.forbidden("You can only mark your own attendance");
  }
  if (input.method === "QR") {
    if (!input.token) throw ApiError.badRequest("QR token required");
    const payload = verifyToken(input.token);
    if (!payload || payload.typ !== "qr" || (payload as any).clubId !== clubId) {
      throw ApiError.badRequest("Invalid or expired QR code");
    }
  }
  if (input.method === "MANUAL" && targetUserId === actor.id && !settings.attendance.selfCheckIn && !isStaffActor) {
    throw ApiError.forbidden("Self check-in is disabled. Ask an admin to mark you present.");
  }
  const day = dayKey();
  const existing = await prisma.attendanceRecord.findUnique({
    where: { clubId_userId_day: { clubId, userId: targetUserId, day } }
  });
  if (existing && existing.status !== "GUEST") {
    throw ApiError.conflict(`Attendance already recorded today (${existing.status})`);
  }
  if (settings.attendance.gpsRequired) {
    if (typeof input.lat !== "number" || typeof input.lng !== "number") {
      throw ApiError.badRequest("GPS location required for check-in at this club");
    }
    if (club.lat == null || club.lng == null) {
      throw ApiError.conflict("Club has no coordinates configured for GPS verification");
    }
    const dist = haversineMeters(input.lat, input.lng, club.lat, club.lng);
    if (dist > settings.attendance.gpsRadiusMeters) {
      throw ApiError.forbidden(`You appear to be ${Math.round(dist)}m away from the club`, "GPS_TOO_FAR");
    }
  }
  const now = new Date();
  const status = attendanceStatusForCheckIn(
    now.getHours() * 60 + now.getMinutes(),
    settings.attendance.startMinutes,
    settings.attendance.graceMinutes
  );
  const record = existing
    ? await prisma.attendanceRecord.update({
        where: { id: existing.id },
        data: { status, method: input.method, lat: input.lat, lng: input.lng, updatedAt: new Date() }
      })
    : await prisma.attendanceRecord.create({
        data: {
          clubId,
          userId: targetUserId,
          day,
          status,
          method: input.method,
          lat: input.lat,
          lng: input.lng
        }
      });
  return record;
}

export async function issueQr(clubId: string, issuerId: string) {
  const day = dayKey();
  const token = signToken({ sub: issuerId, typ: "qr", clubId, day }, 60 * 30);
  return { token, expiresInSec: 1800, day };
}

export async function scanQr(clubId: string, scannerUser: { id: string }, token: string, gps?: { lat?: number; lng?: number }) {
  return checkIn(clubId, scannerUser.id, { method: "QR", token, ...gps }, scannerUser);
}

export async function markManual(
  clubId: string,
  actor: { id: string },
  input: { userId: string; day?: string; status: string; note?: string }
) {
  if (!["PRESENT", "ABSENT", "LATE", "GUEST", "EXCUSED"].includes(input.status)) {
    throw ApiError.badRequest("Invalid attendance status");
  }
  const day = input.day ?? dayKey();
  const membership = await prisma.clubMember.findUnique({ where: { clubId_userId: { clubId, userId: input.userId } } });
  if (!membership || (membership.status !== "ACTIVE" && input.status !== "GUEST")) {
    throw ApiError.badRequest("User is not an active member of this club");
  }
  const existing = await prisma.attendanceRecord.findUnique({
    where: { clubId_userId_day: { clubId, userId: input.userId, day } }
  });
  const record = await prisma.attendanceRecord.upsert({
    where: { clubId_userId_day: { clubId, userId: input.userId, day } },
    create: { clubId, userId: input.userId, day, status: input.status, method: "MANUAL", note: input.note, markedById: actor.id },
    update: { status: input.status, note: input.note ?? null, markedById: actor.id, method: existing?.method ?? "MANUAL" }
  });
  await audit({
    clubId,
    actorUserId: actor.id,
    action: AUDIT_ACTIONS.ATTENDANCE_MARKED,
    entityType: "AttendanceRecord",
    entityId: record.id,
    previousValue: existing ? { status: existing.status } : null,
    newValue: { status: input.status, day, userId: input.userId }
  });
  return record;
}

export async function rosterForDay(clubId: string, dayInput?: string) {
  const day = dayKey(dayInput ? new Date(`${dayInput}T00:00:00`) : undefined);
  const members = await prisma.clubMember.findMany({
    where: { clubId, status: "ACTIVE" },
    include: { user: { select: { id: true, name: true, photoUrl: true, skillLevel: true } } },
    orderBy: { joinedAt: "asc" }
  });
  const records = await prisma.attendanceRecord.findMany({ where: { clubId, day } });
  const byUser = new Map(records.map((r) => [r.userId, r]));
  return {
    day,
    summary: {
      total: members.length,
      present: records.filter((r) => r.status === "PRESENT").length,
      late: records.filter((r) => r.status === "LATE").length,
      absent: records.filter((r) => r.status === "ABSENT").length,
      guest: records.filter((r) => r.status === "GUEST").length,
      excused: records.filter((r) => r.status === "EXCUSED").length
    },
    roster: members.map((m) => ({
      member: m,
      record: byUser.get(m.userId) ?? null
    })),
    rows: members.map((m) => {
      const rec = byUser.get(m.userId);
      return {
        userId: m.userId,
        name: m.user.name,
        photoUrl: m.user.photoUrl,
        status: rec?.status ?? null,
        method: rec?.method ?? null,
        checkInTime: rec?.createdAt ? rec.createdAt.toISOString() : null
      };
    }),
    guests: records.filter((r) => r.status === "GUEST")
  };
}

export async function monthMatrix(clubId: string, month: string) {
  const [y, m] = month.split("-").map((x) => parseInt(x, 10));
  const from = new Date(y, m - 1, 1);
  const to = new Date(y, m, 1);
  const daysInMonth = Math.round((to.getTime() - from.getTime()) / 86400000);

  const dayStrings: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    dayStrings.push(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }

  const [members, records] = await Promise.all([
    prisma.clubMember.findMany({
      where: { clubId, status: "ACTIVE" },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { joinedAt: "asc" }
    }),
    prisma.attendanceRecord.findMany({
      where: { clubId, createdAt: { gte: from, lt: to } },
      orderBy: { day: "asc" }
    })
  ]);

  const recordMap = new Map<string, string>();
  for (const r of records) {
    recordMap.set(`${r.userId}_${r.day}`, r.status);
  }

  const rows = members.map((mem) => ({
    userId: mem.userId,
    name: mem.user.name,
    cells: dayStrings.map((d) => recordMap.get(`${mem.userId}_${d}`) ?? null)
  }));

  return {
    month,
    days: dayStrings,
    daysCount: daysInMonth,
    activeMembers: members.length,
    records,
    rows
  };
}

export async function userHistory(clubId: string, userId: string, take = 60) {
  return prisma.attendanceRecord.findMany({
    where: { clubId, userId },
    orderBy: { day: "desc" },
    take
  });
}

export async function runDailySweep(clubId: string, actor: { id: string }, dayInput?: string) {
  const day = dayKey(dayInput ? new Date(`${dayInput}T00:00:00`) : new Date(Date.now() - 86400000));
  const club = await prisma.club.findFirst({ where: { id: clubId, deletedAt: null } });
  if (!club) throw ApiError.notFound("Club not found");
  const settings = parseClubSettings(club.settings);
  const members = await prisma.clubMember.findMany({ where: { clubId, status: "ACTIVE" } });
  const records = await prisma.attendanceRecord.findMany({ where: { clubId, day } });
  const haveRecord = new Set(records.map((r) => r.userId));
  const missing = members.filter((m) => !haveRecord.has(m.userId));

  let penalized = 0;
  for (const m of missing) {
    await prisma.attendanceRecord.create({
      data: { clubId, userId: m.userId, day, status: "ABSENT", method: "AUTO", markedById: actor.id }
    });
    if (settings.attendance.autoAbsentPenalty) {
      const penalty = await prisma.$transaction(
        (tx) =>
          issueFromEvent(tx, clubId, m.userId, "ABSENCE", {
            relatedType: "ATTENDANCE_DAY",
            relatedId: `${day}:${m.userId}`,
            createdById: actor.id
          }),
        { timeout: 20000, maxWait: 10000 }
      );
      if (penalty) penalized++;
    }
  }
  await audit({
    clubId,
    actorUserId: actor.id,
    action: AUDIT_ACTIONS.DAILY_SWEEP,
    entityType: "AttendanceDay",
    entityId: day,
    newValue: { markedAbsent: missing.length, penalized }
  });
  return { day, markedAbsent: missing.length, penalized };
}

export async function rangeStats(clubId: string, fromDate?: string, toDate?: string) {
  const from = fromDate ? startOfDay(fromDate) : startOfDay(new Date());
  const to = toDate ? endOfDay(toDate) : endOfDay(new Date());
  const records = await prisma.attendanceRecord.findMany({
    where: { clubId, day: { gte: isoDay(from), lte: isoDay(to) } }
  });
  return records;
}

function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

import { prisma } from "@/server/db";
import { ApiError } from "@/lib/api";
import { PLAN_LIMITS, type Plan } from "@/lib/constants";

export async function listCourts(clubId: string) {
  const courts = await prisma.court.findMany({
    where: { clubId, deletedAt: null },
    orderBy: { number: "asc" }
  });
  const now = new Date();
  const activeMatches = await prisma.match.findMany({
    where: { clubId, status: "IN_PROGRESS", courtId: { not: null } },
    select: { courtId: true }
  });
  const activeBookings = await prisma.courtBooking.findMany({
    where: {
      clubId,
      status: "CONFIRMED",
      startTime: { lte: now },
      endTime: { gt: now }
    },
    include: { user: { select: { name: true } } }
  });
  const matchByCourt = new Map(activeMatches.map((m) => [m.courtId!, m]));
  const bookingByCourt = new Map(activeBookings.map((b) => [b.courtId, b]));
  return courts.map((c) => {
    const liveMatch = matchByCourt.get(c.id);
    const liveBooking = bookingByCourt.get(c.id);
    let occupancy: { kind: "MATCH" | "BOOKING"; label: string } | null = null;
    if (liveMatch) occupancy = { kind: "MATCH", label: "Match in progress" };
    else if (liveBooking) occupancy = { kind: "BOOKING", label: `Booked by ${liveBooking.user.name}` };
    return {
      ...c,
      effectiveStatus:
        c.status === "AVAILABLE" && occupancy ? "OCCUPIED" : c.status,
      occupancy
    };
  });
}

export async function createCourt(
  clubId: string,
  input: { name: string; number?: number; type?: string; openHour?: number; closeHour?: number; hourlyFee?: number }
) {
  const club = await prisma.club.findFirst({ where: { id: clubId, deletedAt: null } });
  if (!club) throw ApiError.notFound("Club not found");
  const limit = PLAN_LIMITS[(club.subscriptionPlan as Plan) ?? "FREE"]?.maxCourts ?? 2;
  const count = await prisma.court.count({ where: { clubId, deletedAt: null } });
  if (count >= limit) throw ApiError.paymentRequired(`Court limit reached for the ${club.subscriptionPlan} plan`, "PLAN_LIMIT");
  const maxNumber = await prisma.court.aggregate({ where: { clubId }, _max: { number: true } });
  return prisma.court.create({
    data: {
      clubId,
      name: input.name.trim(),
      number: input.number ?? (maxNumber._max.number ?? 0) + 1,
      type: input.type ?? "SYNTHETIC",
      openHour: input.openHour ?? 6,
      closeHour: input.closeHour ?? 22,
      hourlyFee: input.hourlyFee ?? 0
    }
  });
}

export async function updateCourt(clubId: string, courtId: string, patch: CourtPatch) {
  const court = await prisma.court.findFirst({ where: { id: courtId, clubId, deletedAt: null } });
  if (!court) throw ApiError.notFound("Court not found");
  return prisma.court.update({
    where: { id: courtId },
    data: {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.type !== undefined ? { type: patch.type } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.openHour !== undefined ? { openHour: patch.openHour } : {}),
      ...(patch.closeHour !== undefined ? { closeHour: patch.closeHour } : {}),
      ...(patch.hourlyFee !== undefined ? { hourlyFee: patch.hourlyFee } : {})
    }
  });
}

export interface CourtPatch {
  name?: string;
  type?: string;
  status?: string;
  openHour?: number;
  closeHour?: number;
  hourlyFee?: number;
}

export async function deleteCourt(clubId: string, courtId: string) {
  const active = await prisma.match.findFirst({
    where: { courtId, clubId, status: "IN_PROGRESS" }
  });
  if (active) throw ApiError.conflict("Cannot remove a court while a match is in progress on it");
  await prisma.court.update({ where: { id: courtId }, data: { deletedAt: new Date(), status: "DISABLED" } });
}

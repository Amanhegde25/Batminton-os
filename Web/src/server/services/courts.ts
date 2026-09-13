import { clubs, courts, matches, courtBookings } from "@/server/db";
import { ApiError } from "@/lib/api";
import { PLAN_LIMITS, type Plan } from "@/lib/constants";
import { cuid } from "@/lib/id";

export async function listCourts(clubId: string) {
  const courtList = await courts().find({ clubId, deletedAt: null }).sort({ number: 1 }).toArray();
  const now = new Date();
  const activeMatches = await matches().find(
    { clubId, status: "IN_PROGRESS", courtId: { $ne: null } },
    { projection: { courtId: 1 } }
  ).toArray();
  const activeBookingsList = await courtBookings().aggregate([
    { $match: { clubId, status: "CONFIRMED", startTime: { $lte: now }, endTime: { $gt: now } } },
    {
      $lookup: {
        from: "users",
        let: { uid: "$userId" },
        pipeline: [
          { $match: { $expr: { $eq: ["$id", "$$uid"] } } },
          { $project: { name: 1, _id: 0 } }
        ],
        as: "user"
      }
    },
    { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } }
  ]).toArray();

  const matchByCourt = new Map(activeMatches.filter((m) => m.courtId).map((m) => [m.courtId as string, m]));
  const bookingByCourt = new Map(activeBookingsList.map((b) => [b.courtId as string, b]));

  return courtList.map((c) => {
    const liveMatch = matchByCourt.get(c.id as string);
    const liveBooking = bookingByCourt.get(c.id as string);
    let occupancy: { kind: "MATCH" | "BOOKING"; label: string } | null = null;
    if (liveMatch) occupancy = { kind: "MATCH", label: "Match in progress" };
    else if (liveBooking) occupancy = { kind: "BOOKING", label: `Booked by ${(liveBooking.user as any)?.name ?? "Unknown"}` };
    return {
      ...c,
      effectiveStatus: c.status === "AVAILABLE" && occupancy ? "OCCUPIED" : c.status,
      occupancy
    };
  });
}

export async function createCourt(
  clubId: string,
  input: { name: string; number?: number; type?: string; openHour?: number; closeHour?: number; hourlyFee?: number }
) {
  const club = await clubs().findOne({ id: clubId, deletedAt: null });
  if (!club) throw ApiError.notFound("Club not found");
  const limit = PLAN_LIMITS[(club.subscriptionPlan as Plan)]?.maxCourts ?? PLAN_LIMITS.FREE.maxCourts;
  const count = await courts().countDocuments({ clubId, deletedAt: null });
  if (count >= limit) throw ApiError.paymentRequired(`Court limit reached for the ${club.subscriptionPlan} plan`, "PLAN_LIMIT");

  const maxResult = await courts().find({ clubId }).sort({ number: -1 }).limit(1).toArray();
  const maxNumber = maxResult.length > 0 ? (maxResult[0].number as number) : 0;

  const court = {
    id: cuid(),
    clubId,
    name: input.name.trim(),
    number: input.number ?? maxNumber + 1,
    type: input.type ?? "SYNTHETIC",
    status: "AVAILABLE",
    openHour: input.openHour ?? 6,
    closeHour: input.closeHour ?? 22,
    hourlyFee: input.hourlyFee ?? 0,
    notes: null,
    deletedAt: null,
    createdAt: new Date()
  };
  await courts().insertOne(court);
  return court;
}

export async function updateCourt(clubId: string, courtId: string, patch: CourtPatch) {
  const court = await courts().findOne({ id: courtId, clubId, deletedAt: null });
  if (!court) throw ApiError.notFound("Court not found");
  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) data.name = patch.name;
  if (patch.type !== undefined) data.type = patch.type;
  if (patch.status !== undefined) data.status = patch.status;
  if (patch.openHour !== undefined) data.openHour = patch.openHour;
  if (patch.closeHour !== undefined) data.closeHour = patch.closeHour;
  if (patch.hourlyFee !== undefined) data.hourlyFee = patch.hourlyFee;
  const updated = await courts().findOneAndUpdate(
    { id: courtId },
    { $set: data },
    { returnDocument: "after" }
  );
  return updated;
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
  const active = await matches().findOne({ courtId, clubId, status: "IN_PROGRESS" });
  if (active) throw ApiError.conflict("Cannot remove a court while a match is in progress on it");
  await courts().updateOne({ id: courtId }, { $set: { deletedAt: new Date(), status: "DISABLED" } });
}

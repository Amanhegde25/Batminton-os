import { courts, courtBookings, matches, clubs, walletTransactions } from "@/server/db";
import { ApiError } from "@/lib/api";
import { postTransaction } from "./wallets";
import { notify } from "./notifications";
import { cuid } from "@/lib/id";

export async function createBooking(
  clubId: string,
  user: { id: string },
  input: { courtId: string; startTime: Date; endTime: Date; notes?: string; forUserId?: string }
) {
  const court = await courts().findOne({ id: input.courtId, clubId, deletedAt: null });
  if (!court) throw ApiError.notFound("Court not found");
  if (court.status === "MAINTENANCE" || court.status === "DISABLED") {
    throw ApiError.badRequest(`Court is ${(court.status as string).toLowerCase()}`);
  }
  const start = input.startTime;
  const end = input.endTime;
  if (!(start instanceof Date) || !(end instanceof Date) || isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw ApiError.badRequest("Invalid start/end time");
  }
  if (start >= end) throw ApiError.badRequest("End time must be after start time");
  if (start < new Date()) throw ApiError.badRequest("Cannot book a slot in the past");
  if (start.getHours() < (court.openHour as number) || end.getHours() > (court.closeHour as number) || (end.getHours() === (court.closeHour as number) && end.getMinutes() > 0)) {
    throw ApiError.badRequest(`Court operates ${String(court.openHour).padStart(2, "0")}:00–${String(court.closeHour).padStart(2, "0")}:00`);
  }
  const overlap = await courtBookings().findOne({
    courtId: court.id,
    status: "CONFIRMED",
    startTime: { $lt: end },
    endTime: { $gt: start }
  });
  if (overlap) throw ApiError.conflict("This slot overlaps an existing booking");
  const matchConflict = await matches().findOne({
    courtId: court.id, status: "IN_PROGRESS", startedAt: { $lte: end }
  });
  if (matchConflict && start < new Date((matchConflict.endedAt as Date)?.getTime() ?? Date.now() + 3600000)) {
    throw ApiError.conflict("A live match is using this court");
  }

  const targetUser = input.forUserId ?? user.id;
  const durationH = (end.getTime() - start.getTime()) / 3600000;
  const fee = (court.hourlyFee as number) > 0 ? Math.ceil(durationH * (court.hourlyFee as number)) : 0;

  let paymentStatus = "FREE";
  let amount = 0;
  let txnId: string | null = null;
  if (fee > 0) {
    amount = fee;
    const txn = await postTransaction(null, {
      clubId,
      userId: targetUser,
      amount: -fee,
      type: "BOOKING_FEE",
      description: `Court booking: ${court.name}`,
      createdById: user.id,
      relatedType: "CourtBooking"
    });
    paymentStatus = "PAID";
    txnId = txn.id;
  }

  const booking = {
    id: cuid(),
    clubId,
    courtId: court.id as string,
    userId: targetUser,
    startTime: start,
    endTime: end,
    status: "CONFIRMED",
    paymentStatus,
    amount,
    notes: input.notes ?? null,
    createdById: user.id,
    createdAt: new Date(),
    cancelledById: null,
    cancelledAt: null
  };
  await courtBookings().insertOne(booking);
  if (txnId) {
    await walletTransactions().updateOne({ id: txnId }, { $set: { relatedId: booking.id } });
  }
  await notify({
    userId: targetUser,
    clubId,
    type: "BOOKING_CONFIRMED",
    title: `Court booked: ${court.name}`,
    body: `${start.toLocaleString("en-IN")} – ${end.toLocaleTimeString("en-IN")}${fee ? ` (₹${fee})` : ""}`
  });
  return booking;
}

export async function cancelBooking(clubId: string, actor: { id: string }, bookingId: string, staffOverride: boolean) {
  const booking = await courtBookings().findOne({ id: bookingId, clubId });
  if (!booking) throw ApiError.notFound("Booking not found");
  const court = await courts().findOne({ id: booking.courtId as string });
  if (booking.status === "CANCELLED") throw ApiError.conflict("Already cancelled");
  if (!staffOverride && booking.userId !== actor.id) throw ApiError.forbidden("Not your booking");
  if (booking.status !== "COMPLETED") {
    const windowMin = await cancellationWindow(clubId);
    const msToStart = (booking.startTime as Date).getTime() - Date.now();
    if (!staffOverride && msToStart < windowMin * 60000 && msToStart > 0) {
      throw ApiError.conflict(`Cancellations close ${windowMin} minutes before start. Ask a club admin.`);
    }
  }
  await courtBookings().updateOne(
    { id: bookingId },
    { $set: { status: "CANCELLED", cancelledById: actor.id, cancelledAt: new Date() } }
  );
  if (booking.paymentStatus === "PAID" && (booking.amount as number) > 0) {
    await postTransaction(null, {
      clubId,
      userId: booking.userId as string,
      amount: booking.amount as number,
      type: "REFUND",
      description: `Refund for cancelled booking (${court?.name ?? "Court"})`,
      createdById: actor.id,
      relatedType: "CourtBooking",
      relatedId: booking.id as string
    });
    await courtBookings().updateOne({ id: bookingId }, { $set: { paymentStatus: "REFUNDED" } });
  }
  await notify({
    userId: booking.userId as string,
    clubId,
    type: "BOOKING_CANCELLED",
    title: `Booking cancelled: ${court?.name ?? "Court"}`,
    body: (booking.startTime as Date).toLocaleString("en-IN")
  });
  return courtBookings().findOne({ id: bookingId });
}

async function cancellationWindow(clubId: string): Promise<number> {
  const club = await clubs().findOne({ id: clubId }, { projection: { settings: 1 } });
  if (!club) return 120;
  try {
    const s = JSON.parse(club.settings as string);
    return s?.booking?.cancellationWindowMinutes ?? 120;
  } catch {
    return 120;
  }
}

export async function listBookings(clubId: string, dayInput?: string, forUserId?: string) {
  const day = dayInput ?? new Date().toISOString().slice(0, 10);
  const from = new Date(`${day}T00:00:00`);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  const filter: Record<string, unknown> = {
    clubId,
    status: { $ne: "CANCELLED" },
    startTime: { $gte: from, $lt: to }
  };
  if (forUserId) filter.userId = forUserId;

  return courtBookings().aggregate([
    { $match: filter },
    { $sort: { startTime: 1 } },
    {
      $lookup: {
        from: "courts",
        let: { cid: "$courtId" },
        pipeline: [
          { $match: { $expr: { $eq: ["$id", "$$cid"] } } },
          { $project: { id: 1, name: 1, number: 1, _id: 0 } }
        ],
        as: "court"
      }
    },
    { $unwind: { path: "$court", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "users",
        let: { uid: "$userId" },
        pipeline: [
          { $match: { $expr: { $eq: ["$id", "$$uid"] } } },
          { $project: { id: 1, name: 1, photoUrl: 1, _id: 0 } }
        ],
        as: "user"
      }
    },
    { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } }
  ]).toArray();
}

export async function myUpcoming(clubId: string, userId: string) {
  return courtBookings().aggregate([
    { $match: { clubId, userId, status: "CONFIRMED", startTime: { $gte: new Date() } } },
    { $sort: { startTime: 1 } },
    { $limit: 5 },
    {
      $lookup: {
        from: "courts",
        let: { cid: "$courtId" },
        pipeline: [
          { $match: { $expr: { $eq: ["$id", "$$cid"] } } },
          { $project: { name: 1, number: 1, _id: 0 } }
        ],
        as: "court"
      }
    },
    { $unwind: { path: "$court", preserveNullAndEmptyArrays: true } }
  ]).toArray();
}

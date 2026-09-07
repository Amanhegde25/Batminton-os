import { prisma } from "@/server/db";
import { ApiError } from "@/lib/api";
import { postTransaction } from "./wallets";
import { notify } from "./notifications";

export async function createBooking(
  clubId: string,
  user: { id: string },
  input: { courtId: string; startTime: Date; endTime: Date; notes?: string; forUserId?: string }
) {
  const court = await prisma.court.findFirst({ where: { id: input.courtId, clubId, deletedAt: null } });
  if (!court) throw ApiError.notFound("Court not found");
  if (court.status === "MAINTENANCE" || court.status === "DISABLED") {
    throw ApiError.badRequest(`Court is ${court.status.toLowerCase()}`);
  }
  const start = input.startTime;
  const end = input.endTime;
  if (!(start instanceof Date) || !(end instanceof Date) || isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw ApiError.badRequest("Invalid start/end time");
  }
  if (start >= end) throw ApiError.badRequest("End time must be after start time");
  if (start < new Date()) throw ApiError.badRequest("Cannot book a slot in the past");
  if (start.getHours() < court.openHour || end.getHours() > court.closeHour || (end.getHours() === court.closeHour && end.getMinutes() > 0)) {
    throw ApiError.badRequest(`Court operates ${String(court.openHour).padStart(2, "0")}:00–${String(court.closeHour).padStart(2, "0")}:00`);
  }
  const overlap = await prisma.courtBooking.findFirst({
    where: {
      courtId: court.id,
      status: "CONFIRMED",
      startTime: { lt: end },
      endTime: { gt: start }
    }
  });
  if (overlap) throw ApiError.conflict("This slot overlaps an existing booking");
  const matchConflict = await prisma.match.findFirst({
    where: { courtId: court.id, status: "IN_PROGRESS", startedAt: { lte: end } }
  });
  if (matchConflict && start < new Date(matchConflict.endedAt ?? Date.now() + 3600000)) {
    throw ApiError.conflict("A live match is using this court");
  }

  const targetUser = input.forUserId ?? user.id;
  const durationH = (end.getTime() - start.getTime()) / 3600000;
  const fee = court.hourlyFee > 0 ? Math.ceil(durationH * court.hourlyFee) : 0;

  let paymentStatus = "FREE";
  let amount = 0;
  let txnId: string | null = null;
  if (fee > 0) {
    amount = fee;
    try {
      const txn = await prisma.$transaction((tx) =>
        postTransaction(tx, {
          clubId,
          userId: targetUser,
          amount: -fee,
          type: "BOOKING_FEE",
          description: `Court booking: ${court.name}`,
          createdById: user.id,
          relatedType: "CourtBooking"
        })
      );
      paymentStatus = "PAID";
      txnId = txn.id;
    } catch (e) {
      if (e instanceof Error && e.message.includes("non-zero")) throw e;
      throw e;
    }
  }

  const booking = await prisma.courtBooking.create({
    data: {
      clubId,
      courtId: court.id,
      userId: targetUser,
      startTime: start,
      endTime: end,
      notes: input.notes,
      amount,
      paymentStatus,
      createdById: user.id
    }
  });
  if (txnId) {
    await prisma.walletTransaction.update({
      where: { id: txnId },
      data: { relatedId: booking.id }
    });
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
  const booking = await prisma.courtBooking.findFirst({
    where: { id: bookingId, clubId },
    include: { court: true }
  });
  if (!booking) throw ApiError.notFound("Booking not found");
  if (booking.status === "CANCELLED") throw ApiError.conflict("Already cancelled");
  if (!staffOverride && booking.userId !== actor.id) throw ApiError.forbidden("Not your booking");
  if (booking.status !== "COMPLETED") {
    const windowMin = await cancellationWindow(clubId);
    const msToStart = booking.startTime.getTime() - Date.now();
    if (!staffOverride && msToStart < windowMin * 60000 && msToStart > 0) {
      throw ApiError.conflict(`Cancellations close ${windowMin} minutes before start. Ask a club admin.`);
    }
  }
  const updated = await prisma.courtBooking.update({
    where: { id: bookingId },
    data: { status: "CANCELLED", cancelledById: actor.id, cancelledAt: new Date() }
  });
  if (booking.paymentStatus === "PAID" && booking.amount > 0) {
    await prisma.$transaction((tx) =>
      postTransaction(tx, {
        clubId,
        userId: booking.userId,
        amount: booking.amount,
        type: "REFUND",
        description: `Refund for cancelled booking (${booking.court.name})`,
        createdById: actor.id,
        relatedType: "CourtBooking",
        relatedId: booking.id
      })
    );
    await prisma.courtBooking.update({ where: { id: bookingId }, data: { paymentStatus: "REFUNDED" } });
  }
  await notify({
    userId: booking.userId,
    clubId,
    type: "BOOKING_CANCELLED",
    title: `Booking cancelled: ${booking.court.name}`,
    body: booking.startTime.toLocaleString("en-IN")
  });
  return updated;
}

async function cancellationWindow(clubId: string): Promise<number> {
  const club = await prisma.club.findFirst({ where: { id: clubId }, select: { settings: true } });
  if (!club) return 120;
  try {
    const s = JSON.parse(club.settings);
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
  return prisma.courtBooking.findMany({
    where: {
      clubId,
      status: { not: "CANCELLED" },
      startTime: { gte: from, lt: to },
      ...(forUserId ? { userId: forUserId } : {})
    },
    orderBy: { startTime: "asc" },
    include: {
      court: { select: { id: true, name: true, number: true } },
      user: { select: { id: true, name: true, photoUrl: true } }
    }
  });
}

export async function myUpcoming(clubId: string, userId: string) {
  return prisma.courtBooking.findMany({
    where: { clubId, userId, status: "CONFIRMED", startTime: { gte: new Date() } },
    orderBy: { startTime: "asc" },
    take: 5,
    include: { court: { select: { name: true, number: true } } }
  });
}

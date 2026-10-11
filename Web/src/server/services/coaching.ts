import { coaches, coachingBookings, users, clubs, clubMembers } from "@/server/db";
import { ApiError } from "@/lib/api";
import { cuid } from "@/lib/id";
import { audit } from "./audit";
import { notify } from "./notifications";
import type { SessionUser } from "@/server/auth/types";
import { requireStaff, getClubContext } from "@/server/rbac";
import { DAYS_OF_WEEK, DEFAULT_COACHING_SLOTS, type DayOfWeek } from "@/lib/constants";

export interface CoachRecord {
  id: string;
  clubId: string;
  name: string;
  title?: string | null;
  bio?: string | null;
  phone?: string | null;
  email?: string | null;
  photoUrl?: string | null;
  hourlyFee: number; // in paise (e.g. 50000 = ₹500)
  availableDays: string[];
  availableTimeSlots: string[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CoachingBookingRecord {
  id: string;
  clubId: string;
  coachId: string;
  coachName: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhotoUrl?: string | null;
  sessionDate: string; // YYYY-MM-DD
  dayOfWeek: string;
  timeSlot: string;
  notes?: string | null;
  fee: number;
  status: "CONFIRMED" | "COMPLETED" | "CANCELLED";
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCoachInput {
  name: string;
  title?: string;
  bio?: string;
  phone?: string;
  email?: string;
  photoUrl?: string;
  hourlyFee?: number; // In paise
  availableDays?: string[];
  availableTimeSlots?: string[];
}

export interface UpdateCoachInput {
  name?: string;
  title?: string;
  bio?: string;
  phone?: string;
  email?: string;
  photoUrl?: string;
  hourlyFee?: number;
  availableDays?: string[];
  availableTimeSlots?: string[];
  active?: boolean;
}

export interface BookSessionInput {
  coachId: string;
  sessionDate: string; // "YYYY-MM-DD"
  timeSlot: string; // "07:00 - 08:00"
  notes?: string;
}

/**
 * Lists all coaches for a club.
 */
export async function listCoaches(clubId: string, onlyActive = false): Promise<CoachRecord[]> {
  const filter: Record<string, unknown> = { clubId };
  if (onlyActive) {
    filter.active = true;
  }
  const items = await coaches().find(filter).sort({ name: 1 }).toArray();
  return items.map((c) => ({
    id: c.id as string,
    clubId: c.clubId as string,
    name: c.name as string,
    title: (c.title as string) || null,
    bio: (c.bio as string) || null,
    phone: (c.phone as string) || null,
    email: (c.email as string) || null,
    photoUrl: (c.photoUrl as string) || null,
    hourlyFee: typeof c.hourlyFee === "number" ? c.hourlyFee : 0,
    availableDays: Array.isArray(c.availableDays) ? c.availableDays : [...DAYS_OF_WEEK],
    availableTimeSlots: Array.isArray(c.availableTimeSlots) ? c.availableTimeSlots : [...DEFAULT_COACHING_SLOTS],
    active: c.active !== false,
    createdAt: (c.createdAt as Date) || new Date(),
    updatedAt: (c.updatedAt as Date) || new Date()
  }));
}

/**
 * Creates a new coach in the club (Club Admin / Owner clearance).
 */
export async function createCoach(
  clubId: string,
  actor: SessionUser,
  input: CreateCoachInput
): Promise<CoachRecord> {
  await requireStaff(clubId, actor);

  if (!input.name || input.name.trim().length < 2) {
    throw ApiError.badRequest("Coach name is required (min 2 characters)");
  }

  const days = input.availableDays && input.availableDays.length > 0
    ? input.availableDays.map((d) => d.toUpperCase()).filter((d) => DAYS_OF_WEEK.includes(d as DayOfWeek))
    : [...DAYS_OF_WEEK];

  const slots = input.availableTimeSlots && input.availableTimeSlots.length > 0
    ? input.availableTimeSlots.map((s) => s.trim()).filter(Boolean)
    : [...DEFAULT_COACHING_SLOTS];

  const id = cuid();
  const now = new Date();
  const coachDoc = {
    id,
    clubId,
    name: input.name.trim(),
    title: input.title?.trim() || null,
    bio: input.bio?.trim() || null,
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    photoUrl: input.photoUrl?.trim() || null,
    hourlyFee: typeof input.hourlyFee === "number" && input.hourlyFee >= 0 ? input.hourlyFee : 0,
    availableDays: days,
    availableTimeSlots: slots,
    active: true,
    createdAt: now,
    updatedAt: now
  };

  await coaches().insertOne(coachDoc);

  await audit({
    clubId,
    actorUserId: actor.id,
    action: "coach.created",
    entityType: "Coach",
    entityId: id,
    newValue: { name: coachDoc.name, hourlyFee: coachDoc.hourlyFee }
  });

  return coachDoc;
}

/**
 * Updates coach details, availability, and active status.
 */
export async function updateCoach(
  clubId: string,
  coachId: string,
  actor: SessionUser,
  input: UpdateCoachInput
): Promise<CoachRecord> {
  await requireStaff(clubId, actor);

  const existing = await coaches().findOne({ id: coachId, clubId });
  if (!existing) throw ApiError.notFound("Coach not found in this club");

  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (input.name !== undefined) {
    if (input.name.trim().length < 2) throw ApiError.badRequest("Name must be at least 2 characters");
    updates.name = input.name.trim();
  }
  if (input.title !== undefined) updates.title = input.title?.trim() || null;
  if (input.bio !== undefined) updates.bio = input.bio?.trim() || null;
  if (input.phone !== undefined) updates.phone = input.phone?.trim() || null;
  if (input.email !== undefined) updates.email = input.email?.trim() || null;
  if (input.photoUrl !== undefined) updates.photoUrl = input.photoUrl?.trim() || null;
  if (input.hourlyFee !== undefined) updates.hourlyFee = Math.max(0, input.hourlyFee);
  if (input.active !== undefined) updates.active = Boolean(input.active);
  if (input.availableDays !== undefined) {
    updates.availableDays = input.availableDays
      .map((d) => d.toUpperCase())
      .filter((d) => DAYS_OF_WEEK.includes(d as DayOfWeek));
  }
  if (input.availableTimeSlots !== undefined) {
    updates.availableTimeSlots = input.availableTimeSlots.map((s) => s.trim()).filter(Boolean);
  }

  await coaches().updateOne({ id: coachId, clubId }, { $set: updates });

  await audit({
    clubId,
    actorUserId: actor.id,
    action: "coach.updated",
    entityType: "Coach",
    entityId: coachId,
    previousValue: { name: existing.name },
    newValue: updates
  });

  const updated = await coaches().findOne({ id: coachId, clubId });
  return updated as unknown as CoachRecord;
}

/**
 * Deletes a coach from the club.
 */
export async function deleteCoach(clubId: string, coachId: string, actor: SessionUser): Promise<void> {
  await requireStaff(clubId, actor);

  const existing = await coaches().findOne({ id: coachId, clubId });
  if (!existing) throw ApiError.notFound("Coach not found");

  await coaches().deleteOne({ id: coachId, clubId });

  await audit({
    clubId,
    actorUserId: actor.id,
    action: "coach.deleted",
    entityType: "Coach",
    entityId: coachId,
    previousValue: { name: existing.name }
  });
}

/**
 * Helper to compute the day of the week from YYYY-MM-DD.
 */
function getDayOfWeekFromDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const dayIndex = d.getUTCDay(); // 0 is Sunday, 1 is Monday ...
  const map = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
  return map[dayIndex];
}

/**
 * Books a coaching session with a coach.
 */
export async function bookCoachingSession(
  clubId: string,
  user: SessionUser,
  input: BookSessionInput
): Promise<CoachingBookingRecord> {
  await getClubContext(clubId, user);

  if (!input.coachId) throw ApiError.badRequest("Coach ID is required");
  if (!input.sessionDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.sessionDate)) {
    throw ApiError.badRequest("Valid session date (YYYY-MM-DD) is required");
  }
  if (!input.timeSlot) throw ApiError.badRequest("Time slot is required");

  // Validate date is not in the past
  const todayStr = new Date().toISOString().split("T")[0];
  if (input.sessionDate < todayStr) {
    throw ApiError.badRequest("Cannot book a coaching session in the past");
  }

  const coach = await coaches().findOne({ id: input.coachId, clubId, active: true });
  if (!coach) throw ApiError.notFound("Coach not found or currently unavailable");

  const dayOfWeek = getDayOfWeekFromDate(input.sessionDate);
  const availableDays = Array.isArray(coach.availableDays) ? coach.availableDays : [...DAYS_OF_WEEK];
  if (!availableDays.includes(dayOfWeek)) {
    throw ApiError.badRequest(
      `${coach.name} is not available on ${dayOfWeek}s. Available days: ${availableDays.join(", ")}`
    );
  }

  const availableSlots = Array.isArray(coach.availableTimeSlots) ? coach.availableTimeSlots : [...DEFAULT_COACHING_SLOTS];
  if (!availableSlots.includes(input.timeSlot.trim())) {
    throw ApiError.badRequest(
      `Selected slot "${input.timeSlot}" is not offered by ${coach.name}. Available slots: ${availableSlots.join(", ")}`
    );
  }

  // Conflict check: Check if coach is already booked for this date and timeslot
  const conflict = await coachingBookings().findOne({
    clubId,
    coachId: input.coachId,
    sessionDate: input.sessionDate,
    timeSlot: input.timeSlot.trim(),
    status: { $ne: "CANCELLED" }
  });
  if (conflict) {
    throw ApiError.conflict(
      `${coach.name} is already booked for ${input.timeSlot} on ${input.sessionDate}. Please pick another slot.`
    );
  }

  const id = cuid();
  const now = new Date();
  const bookingDoc = {
    id,
    clubId,
    coachId: coach.id,
    coachName: coach.name,
    userId: user.id,
    userName: user.name || "Member",
    userEmail: user.email || "",
    sessionDate: input.sessionDate,
    dayOfWeek,
    timeSlot: input.timeSlot.trim(),
    notes: input.notes?.trim() || null,
    fee: typeof coach.hourlyFee === "number" ? coach.hourlyFee : 0,
    status: "CONFIRMED" as const,
    createdAt: now,
    updatedAt: now
  };

  await coachingBookings().insertOne(bookingDoc);

  // Send in-app notification to member
  await notify({
    userId: user.id,
    clubId,
    type: "COACHING_BOOKED",
    title: "Coaching Session Confirmed! 🏸",
    body: `Your session with ${coach.name} is booked for ${input.sessionDate} (${dayOfWeek}) at ${input.timeSlot}.`,
    data: { bookingId: id, coachId: coach.id, sessionDate: input.sessionDate, timeSlot: input.timeSlot }
  });

  return bookingDoc;
}

/**
 * Lists coaching bookings.
 * Staff can view all bookings; members view their own bookings.
 */
export async function listCoachingBookings(
  clubId: string,
  user: SessionUser,
  options?: { coachId?: string; status?: string; myOnly?: boolean }
): Promise<CoachingBookingRecord[]> {
  const ctx = await getClubContext(clubId, user);
  const isStaff = ctx.membership?.role === "OWNER" || ctx.membership?.role === "ADMIN" || user.role === "SUPER_ADMIN";

  const filter: Record<string, unknown> = { clubId };

  if (options?.coachId) {
    filter.coachId = options.coachId;
  }
  if (options?.status && options.status !== "ALL") {
    filter.status = options.status;
  }

  // If not staff or if myOnly is requested, strictly filter by userId
  if (!isStaff || options?.myOnly) {
    filter.userId = user.id;
  }

  const items = await coachingBookings()
    .find(filter)
    .sort({ sessionDate: -1, timeSlot: 1 })
    .toArray();

  return items.map((b) => ({
    id: b.id as string,
    clubId: b.clubId as string,
    coachId: b.coachId as string,
    coachName: b.coachName as string,
    userId: b.userId as string,
    userName: (b.userName as string) || "Member",
    userEmail: (b.userEmail as string) || "",
    userPhotoUrl: (b.userPhotoUrl as string) || null,
    sessionDate: b.sessionDate as string,
    dayOfWeek: b.dayOfWeek as string,
    timeSlot: b.timeSlot as string,
    notes: (b.notes as string) || null,
    fee: typeof b.fee === "number" ? b.fee : 0,
    status: (b.status as "CONFIRMED" | "COMPLETED" | "CANCELLED") || "CONFIRMED",
    createdAt: (b.createdAt as Date) || new Date(),
    updatedAt: (b.updatedAt as Date) || new Date()
  }));
}

/**
 * Cancels a coaching booking.
 * Members can cancel their own booking; Club staff can cancel any booking.
 */
export async function cancelCoachingBooking(
  clubId: string,
  bookingId: string,
  user: SessionUser,
  reason?: string
): Promise<CoachingBookingRecord> {
  const ctx = await getClubContext(clubId, user);
  const isStaff = ctx.membership?.role === "OWNER" || ctx.membership?.role === "ADMIN" || user.role === "SUPER_ADMIN";

  const booking = await coachingBookings().findOne({ id: bookingId, clubId });
  if (!booking) throw ApiError.notFound("Coaching booking not found");

  if (!isStaff && booking.userId !== user.id) {
    throw ApiError.forbidden("You can only cancel your own coaching bookings");
  }

  if (booking.status === "CANCELLED") {
    throw ApiError.badRequest("This booking is already cancelled");
  }

  const now = new Date();
  await coachingBookings().updateOne(
    { id: bookingId, clubId },
    { $set: { status: "CANCELLED", cancelReason: reason || null, updatedAt: now } }
  );

  // If staff cancelled member's session, notify the member
  if (isStaff && booking.userId !== user.id) {
    await notify({
      userId: booking.userId as string,
      clubId,
      type: "COACHING_CANCELLED",
      title: "Coaching Session Cancelled",
      body: `Your session with ${booking.coachName} on ${booking.sessionDate} at ${booking.timeSlot} was cancelled by club administration.${
        reason ? ` Reason: ${reason}` : ""
      }`
    });
  }

  const updated = await coachingBookings().findOne({ id: bookingId, clubId });
  return updated as unknown as CoachingBookingRecord;
}

/**
 * Updates booking status (e.g. mark COMPLETED by club admin).
 */
export async function updateBookingStatus(
  clubId: string,
  bookingId: string,
  actor: SessionUser,
  status: "CONFIRMED" | "COMPLETED" | "CANCELLED"
): Promise<CoachingBookingRecord> {
  await requireStaff(clubId, actor);

  const booking = await coachingBookings().findOne({ id: bookingId, clubId });
  if (!booking) throw ApiError.notFound("Coaching booking not found");

  await coachingBookings().updateOne(
    { id: bookingId, clubId },
    { $set: { status, updatedAt: new Date() } }
  );

  const updated = await coachingBookings().findOne({ id: bookingId, clubId });
  return updated as unknown as CoachingBookingRecord;
}

import { handler, ok, parseBody } from "@/lib/api";
import { z } from "zod";
import { currentUser } from "@/server/auth/session";
import { getClubContext, requireUser } from "@/server/rbac";
import { cancelBooking, createBooking, listBookings, myUpcoming } from "@/server/services/bookings";

export const GET = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id } = await params;
  await getClubContext(id, user);
  const url = new URL(req.url);
  if (url.searchParams.get("view") === "mine") {
    return ok(await myUpcoming(id, user.id));
  }
  return ok(await listBookings(id, url.searchParams.get("date") ?? undefined));
});

const createSchema = z.object({
  courtId: z.string(),
  startTime: z.string().min(10),
  endTime: z.string().min(10),
  notes: z.string().max(200).optional(),
  forUserId: z.string().optional()
});

export const POST = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id } = await params;
  const ctx = await getClubContext(id, user);
  const input = await parseBody(req, createSchema);
  const staff = ["OWNER", "ADMIN"].includes(ctx.membership?.role ?? "");
  const start = new Date(input.startTime);
  const end = new Date(input.endTime);
  return ok(
    await createBooking(id, user, {
      courtId: input.courtId,
      startTime: start,
      endTime: end,
      notes: input.notes,
      forUserId: staff ? input.forUserId : undefined
    })
  );
});

const cancelSchema = z.object({ bookingId: z.string() });

export const DELETE = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id } = await params;
  const ctx = await getClubContext(id, user);
  const input = await parseBody(req, cancelSchema);
  const staff = ["OWNER", "ADMIN"].includes(ctx.membership?.role ?? "");
  return ok(await cancelBooking(id, user, input.bookingId, staff));
});

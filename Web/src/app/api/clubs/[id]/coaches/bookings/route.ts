import { handler, ok, parseBody } from "@/lib/api";
import { z } from "zod";
import { currentUser } from "@/server/auth/session";
import { requireUser } from "@/server/rbac";
import { listCoachingBookings, bookCoachingSession } from "@/server/services/coaching";

export const GET = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id: clubId } = await params;
  const url = new URL(req.url);
  const coachId = url.searchParams.get("coachId") || undefined;
  const status = url.searchParams.get("status") || undefined;
  const myOnly = url.searchParams.get("myOnly") === "true";

  const items = await listCoachingBookings(clubId, user, { coachId, status, myOnly });
  return ok({ items });
});

const bookSchema = z.object({
  coachId: z.string().min(1),
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  timeSlot: z.string().min(1),
  notes: z.string().max(300).optional()
});

export const POST = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id: clubId } = await params;
  const body = await parseBody(req, bookSchema);
  const booking = await bookCoachingSession(clubId, user, body);
  return ok(booking);
});

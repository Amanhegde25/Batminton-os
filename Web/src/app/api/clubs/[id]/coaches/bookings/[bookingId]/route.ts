import { handler, ok, parseBody } from "@/lib/api";
import { z } from "zod";
import { currentUser } from "@/server/auth/session";
import { requireUser } from "@/server/rbac";
import { cancelCoachingBooking, updateBookingStatus } from "@/server/services/coaching";

const patchSchema = z.object({
  action: z.enum(["cancel", "update_status"]).optional(),
  status: z.enum(["CONFIRMED", "COMPLETED", "CANCELLED"]).optional(),
  reason: z.string().max(200).optional()
});

export const PATCH = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id: clubId, bookingId } = await params;
  const body = await parseBody(req, patchSchema);

  if (body.action === "cancel" || body.status === "CANCELLED") {
    const res = await cancelCoachingBooking(clubId, bookingId, user, body.reason);
    return ok(res);
  }

  if (body.status) {
    const res = await updateBookingStatus(clubId, bookingId, user, body.status);
    return ok(res);
  }

  return ok({ error: "No action specified" });
});

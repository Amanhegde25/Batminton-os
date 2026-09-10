import { handler, ok, parseBody } from "@/lib/api";
import { z } from "zod";
import { currentUser } from "@/server/auth/session";
import { requireStaff, requireUser } from "@/server/rbac";
import * as attendance from "@/server/services/attendance";

const schema = z.object({
  method: z.enum(["MANUAL", "QR", "GPS", "APP_SELF"]).default("MANUAL"),
  token: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  userId: z.string().optional(),
  status: z.enum(["PRESENT", "ABSENT", "LATE", "GUEST", "EXCUSED"]).optional()
});

export const POST = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id } = await params;
  const input = await parseBody(req, schema);

  const isTargetingOther = input.userId && input.userId !== user.id;
  const isSpecialStatus = input.status && input.status !== "PRESENT";

  if (isTargetingOther || isSpecialStatus) {
    await requireStaff(id, user);
    return ok(
      await attendance.markManual(id, user, {
        userId: input.userId ?? user.id,
        status: input.status!
      })
    );
  }

  const method = input.method === "APP_SELF" ? "MANUAL" : input.method;
  return ok(
    await attendance.checkIn(
      id,
      user.id,
      { method, token: input.token, lat: input.lat, lng: input.lng },
      user
    )
  );
});

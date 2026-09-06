import { handler, ok, parseBody } from "@/lib/api";
import { z } from "zod";
import { currentUser } from "@/server/auth/session";
import { requireStaff, requireUser } from "@/server/rbac";
import * as attendance from "@/server/services/attendance";

const schema = z.object({
  method: z.enum(["MANUAL", "QR", "GPS"]).default("MANUAL"),
  token: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  userId: z.string().optional()
});

export const POST = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id } = await params;
  const input = await parseBody(req, schema);
  return ok(
    await attendance.checkIn(
      id,
      input.userId ?? user.id,
      { method: input.method, token: input.token, lat: input.lat, lng: input.lng },
      user
    )
  );
});

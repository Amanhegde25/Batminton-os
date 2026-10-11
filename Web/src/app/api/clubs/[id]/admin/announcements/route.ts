import { handler, ok, parseBody } from "@/lib/api";
import { currentUser } from "@/server/auth/session";
import { requireUser, requireStaff } from "@/server/rbac";
import { broadcastAnnouncement } from "@/server/services/club-admin";
import { z } from "zod";

const announcementSchema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(1000)
});

export const POST = handler(async (req, ctx) => {
  const user = await requireUser(await currentUser(req));
  const { id } = await ctx.params;
  await requireStaff(id, user);

  const body = await parseBody(req, announcementSchema);
  const result = await broadcastAnnouncement(id, user.id, body);
  return ok(result);
});

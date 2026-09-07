import { handler, ok, parseBody } from "@/lib/api";
import { z } from "zod";
import { currentUser } from "@/server/auth/session";
import { requireUser } from "@/server/rbac";
import { listNotifications, markRead } from "@/server/services/notifications";

export const GET = handler(async (req) => {
  const user = await requireUser(await currentUser());
  const page = Number(new URL(req.url).searchParams.get("page") ?? 1);
  return ok(await listNotifications(user.id, page));
});

export const POST = handler(async (req) => {
  const user = await requireUser(await currentUser());
  const input = await parseBody(req, z.object({ ids: z.array(z.string()).optional() }));
  return ok({ marked: await markRead(user.id, input.ids) });
});

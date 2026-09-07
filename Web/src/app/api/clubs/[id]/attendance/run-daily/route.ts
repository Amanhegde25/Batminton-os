import { handler, ok, parseBody } from "@/lib/api";
import { z } from "zod";
import { env } from "@/lib/env";
import { currentUser } from "@/server/auth/session";
import { requireStaff, requireUser } from "@/server/rbac";
import { runDailySweep } from "@/server/services/attendance";

const schema = z.object({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() });

export const POST = handler(async (req, { params }) => {
  const { id } = await params;
  const cronHeader = req.headers.get("x-cron-secret");
  if (env.cronSecret && cronHeader === env.cronSecret) {
    const body = await parseBody(req, schema.catch({}));
    return ok(await runDailySweep(id, { id: "cron" }, body.day));
  }
  const user = await requireUser(await currentUser());
  await requireStaff(id, user);
  const body = await parseBody(req, schema);
  return ok(await runDailySweep(id, user, body.day));
});

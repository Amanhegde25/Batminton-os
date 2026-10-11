import { handler, ok, parseBody } from "@/lib/api";
import { currentUser } from "@/server/auth/session";
import { requireSuperAdmin } from "@/server/rbac";
import { changeClubPlan } from "@/server/services/platform";
import { z } from "zod";

const planSchema = z.object({
  plan: z.string().min(1)
});

export const PATCH = handler(async (req, ctx) => {
  const actor = await requireSuperAdmin(await currentUser(req));
  const { clubId } = await ctx.params;
  const { plan } = await parseBody(req, planSchema);

  const updated = await changeClubPlan(clubId, plan, actor.id);
  return ok(updated);
});

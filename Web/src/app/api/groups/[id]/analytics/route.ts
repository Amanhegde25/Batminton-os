import { handler, ok } from "@/lib/api";
import { currentUser } from "@/server/auth/session";
import { requireUser } from "@/server/rbac";
import { groupAnalytics } from "@/server/services/groups";

export const GET = handler(async (req, ctx) => {
  const user = await requireUser(await currentUser(req));
  const { id } = await ctx.params;

  const data = await groupAnalytics(id, user.id);
  return ok(data);
});

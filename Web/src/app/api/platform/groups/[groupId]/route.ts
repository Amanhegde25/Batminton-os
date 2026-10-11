import { handler, ok } from "@/lib/api";
import { currentUser } from "@/server/auth/session";
import { requireSuperAdmin } from "@/server/rbac";
import { deletePlatformGroup } from "@/server/services/platform";

export const DELETE = handler(async (req, ctx) => {
  const actor = await requireSuperAdmin(await currentUser(req));
  const { groupId } = await ctx.params;
  await deletePlatformGroup(groupId, actor.id);
  return ok({ deleted: true });
});

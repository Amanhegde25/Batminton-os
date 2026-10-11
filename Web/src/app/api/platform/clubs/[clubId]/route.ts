import { handler, ok } from "@/lib/api";
import { currentUser } from "@/server/auth/session";
import { requireSuperAdmin } from "@/server/rbac";
import { deleteClub } from "@/server/services/platform";

export const DELETE = handler(async (req, ctx) => {
  const actor = await requireSuperAdmin(await currentUser(req));
  const { clubId } = await ctx.params;
  await deleteClub(clubId, actor.id);
  return ok({ deleted: true });
});

import { handler, ok } from "@/lib/api";
import { currentUser } from "@/server/auth/session";
import { requireUser } from "@/server/rbac";
import { deleteGroupPost } from "@/server/services/groups";

export const DELETE = handler(async (req, ctx) => {
  const user = await requireUser(await currentUser(req));
  const { id, postId } = await ctx.params;

  const result = await deleteGroupPost(id, postId, user.id);
  return ok(result);
});

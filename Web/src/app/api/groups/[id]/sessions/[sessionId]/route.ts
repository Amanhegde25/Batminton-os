import { handler, ok } from "@/lib/api";
import { currentUser } from "@/server/auth/session";
import { requireUser } from "@/server/rbac";
import { deleteGroupSession } from "@/server/services/groups";

export const DELETE = handler(async (req, ctx) => {
  const user = await requireUser(await currentUser(req));
  const { id, sessionId } = await ctx.params;

  const result = await deleteGroupSession(id, sessionId, user.id);
  return ok(result);
});

import { handler, ok, parseBody, ApiError } from "@/lib/api";
import { currentUser } from "@/server/auth/session";
import { requireSuperAdmin } from "@/server/rbac";
import { updateUserRole, suspendUser, deleteUser } from "@/server/services/platform";
import { z } from "zod";

const patchSchema = z.object({
  action: z.enum(["role", "suspend"]).optional(),
  role: z.enum(["SUPER_ADMIN", "PLAYER"]).optional()
});

export const PATCH = handler(async (req, ctx) => {
  const actor = await requireSuperAdmin(await currentUser(req));
  const { userId } = await ctx.params;
  const body = await parseBody(req, patchSchema);

  if (body.action === "suspend") {
    const res = await suspendUser(userId, actor.id);
    return ok(res);
  }

  if (body.role) {
    const res = await updateUserRole(userId, body.role, actor.id);
    return ok(res);
  }

  throw ApiError.badRequest("Invalid action or role provided");
});

export const DELETE = handler(async (req, ctx) => {
  const actor = await requireSuperAdmin(await currentUser(req));
  const { userId } = await ctx.params;
  await deleteUser(userId, actor.id);
  return ok({ deleted: true });
});

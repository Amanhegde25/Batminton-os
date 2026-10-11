import { handler, ok, parseBody, ApiError } from "@/lib/api";
import { currentUser } from "@/server/auth/session";
import { requireUser } from "@/server/rbac";
import { updateGroupMember } from "@/server/services/groups";
import { z } from "zod";

const memberPatchSchema = z.object({
  role: z.enum(["LEADER", "ADMIN", "MEMBER"]).optional(),
  remove: z.boolean().optional()
});

export const PATCH = handler(async (req, ctx) => {
  const user = await requireUser(await currentUser(req));
  const { id, userId } = await ctx.params;
  const body = await parseBody(req, memberPatchSchema);

  const res = await updateGroupMember(id, user.id, userId, body);
  return ok(res);
});

export const DELETE = handler(async (req, ctx) => {
  const user = await requireUser(await currentUser(req));
  const { id, userId } = await ctx.params;

  const res = await updateGroupMember(id, user.id, userId, { remove: true });
  return ok(res);
});

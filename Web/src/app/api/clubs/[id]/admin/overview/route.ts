import { handler, ok } from "@/lib/api";
import { currentUser } from "@/server/auth/session";
import { requireUser, requireStaff } from "@/server/rbac";
import { clubAdminOverview } from "@/server/services/club-admin";

export const GET = handler(async (req, ctx) => {
  const user = await requireUser(await currentUser(req));
  const { id } = await ctx.params;
  await requireStaff(id, user);

  const data = await clubAdminOverview(id);
  return ok(data);
});

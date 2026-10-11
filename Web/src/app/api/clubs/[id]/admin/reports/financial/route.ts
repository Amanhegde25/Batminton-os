import { handler, ok } from "@/lib/api";
import { currentUser } from "@/server/auth/session";
import { requireUser, requireStaff } from "@/server/rbac";
import { financialReport } from "@/server/services/club-admin";

export const GET = handler(async (req, ctx) => {
  const user = await requireUser(await currentUser(req));
  const { id } = await ctx.params;
  await requireStaff(id, user);

  const url = new URL(req.url);
  const startDate = url.searchParams.get("startDate") || undefined;
  const endDate = url.searchParams.get("endDate") || undefined;

  const data = await financialReport(id, { startDate, endDate });
  return ok(data);
});

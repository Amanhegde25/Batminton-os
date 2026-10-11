import { handler, ok } from "@/lib/api";
import { currentUser } from "@/server/auth/session";
import { requireUser, requireStaff } from "@/server/rbac";
import { clubRevenueBreakdown } from "@/server/services/club-admin";

export const GET = handler(async (req, ctx) => {
  const user = await requireUser(await currentUser(req));
  const { id } = await ctx.params;
  await requireStaff(id, user);

  const url = new URL(req.url);
  const days = parseInt(url.searchParams.get("days") || "30", 10) || 30;

  const data = await clubRevenueBreakdown(id, days);
  return ok(data);
});

import { handler, ok } from "@/lib/api";
import { currentUser } from "@/server/auth/session";
import { requireManagerOrCoach, requireUser } from "@/server/rbac";
import { clubDashboard } from "@/server/services/analytics";

export const GET = handler(async (_req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id } = await params;
  await requireManagerOrCoach(id, user);
  return ok(await clubDashboard(id));
});

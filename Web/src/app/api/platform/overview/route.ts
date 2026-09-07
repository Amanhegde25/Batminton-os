import { handler, ok } from "@/lib/api";
import { currentUser } from "@/server/auth/session";
import { requireSuperAdmin } from "@/server/rbac";
import { platformOverview } from "@/server/services/platform";

export const GET = handler(async () => {
  await requireSuperAdmin(await currentUser());
  return ok(await platformOverview());
});

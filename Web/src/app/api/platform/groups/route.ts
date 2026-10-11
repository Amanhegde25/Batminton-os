import { handler, ok } from "@/lib/api";
import { currentUser } from "@/server/auth/session";
import { requireSuperAdmin } from "@/server/rbac";
import { listPlatformGroups } from "@/server/services/platform";

export const GET = handler(async (req) => {
  await requireSuperAdmin(await currentUser(req));
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") || "1", 10) || 1;
  const search = url.searchParams.get("search") || undefined;

  const data = await listPlatformGroups(page, search);
  return ok(data);
});

import { handler, ok } from "@/lib/api";
import { currentUser } from "@/server/auth/session";
import { requireSuperAdmin } from "@/server/rbac";
import { listPlatformUsers } from "@/server/services/platform";

export const GET = handler(async (req) => {
  await requireSuperAdmin(await currentUser(req));
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") || "1", 10) || 1;
  const search = url.searchParams.get("search") || undefined;
  const role = url.searchParams.get("role") || undefined;

  const data = await listPlatformUsers(page, search, role);
  return ok(data);
});

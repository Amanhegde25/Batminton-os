import { handler, ok } from "@/lib/api";
import { currentUser } from "@/server/auth/session";
import { requireSuperAdmin } from "@/server/rbac";
import { platformAuditLog } from "@/server/services/platform";

export const GET = handler(async (req) => {
  await requireSuperAdmin(await currentUser(req));
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") || "1", 10) || 1;
  const pageSize = parseInt(url.searchParams.get("pageSize") || "50", 10) || 50;

  const data = await platformAuditLog(page, pageSize);
  return ok(data);
});

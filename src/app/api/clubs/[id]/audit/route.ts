import { handler, ok } from "@/lib/api";
import { currentUser } from "@/server/auth/session";
import { requireStaff, requireUser } from "@/server/rbac";
import { listAudit } from "@/server/services/audit";

export const GET = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id } = await params;
  await requireStaff(id, user);
  const page = Number(new URL(req.url).searchParams.get("page") ?? 1);
  return ok(await listAudit(id, page));
});

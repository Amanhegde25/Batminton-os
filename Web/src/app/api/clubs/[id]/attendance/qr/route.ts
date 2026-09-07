import { handler, ok } from "@/lib/api";
import { currentUser } from "@/server/auth/session";
import { requireStaff, requireUser } from "@/server/rbac";
import { issueQr } from "@/server/services/attendance";

export const GET = handler(async (_req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id } = await params;
  await requireStaff(id, user);
  return ok(await issueQr(id, user.id));
});

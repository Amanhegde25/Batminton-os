import { ApiError, handler, ok } from "@/lib/api";
import { currentUser } from "@/server/auth/session";
import { requireUser } from "@/server/rbac";
import { requestJoin } from "@/server/services/members";

export const POST = handler(async (_req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id } = await params;
  if (!user) throw ApiError.unauthorized();
  return ok(await requestJoin(id, user));
});

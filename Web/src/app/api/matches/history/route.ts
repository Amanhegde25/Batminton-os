import { handler, ok } from "@/lib/api";
import { currentUser } from "@/server/auth/session";
import { requireUser } from "@/server/rbac";
import { listUserMatchHistory } from "@/server/services/matches";

export const GET = handler(async (req) => {
  const user = await requireUser(await currentUser());
  const url = new URL(req.url);
  const q = url.searchParams.get("q") || undefined;
  const clubId = url.searchParams.get("clubId") || undefined;
  const outcome = (url.searchParams.get("outcome") as "ALL" | "WON" | "LOST") || undefined;
  const status = url.searchParams.get("status") || undefined;
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const pageSize = parseInt(url.searchParams.get("pageSize") || "20", 10);

  const result = await listUserMatchHistory(user.id, {
    q,
    clubId,
    outcome,
    status,
    page,
    pageSize
  });

  return ok(result);
});

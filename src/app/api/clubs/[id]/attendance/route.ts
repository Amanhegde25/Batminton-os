import { handler, ok } from "@/lib/api";
import { currentUser } from "@/server/auth/session";
import { getClubContext, requireUser } from "@/server/rbac";
import * as attendance from "@/server/services/attendance";

export const GET = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id } = await params;
  const url = new URL(req.url);
  const view = url.searchParams.get("view");

  if (view === "history") {
    await getClubContext(id, user);
    const userId = url.searchParams.get("userId") ?? user.id;
    return ok(await attendance.userHistory(id, userId));
  }
  if (view === "month") {
    await getClubContext(id, user);
    const month = url.searchParams.get("month");
    const now = new Date();
    const m = month && /^\d{4}-\d{2}$/.test(month) ? month : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return ok(await attendance.monthMatrix(id, m));
  }

  await getClubContext(id, user);
  return ok(await attendance.rosterForDay(id, url.searchParams.get("date") ?? undefined));
});

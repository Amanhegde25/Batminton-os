import { handler, ok, parseBody } from "@/lib/api";
import { z } from "zod";
import { currentUser } from "@/server/auth/session";
import { getClubContext, requireStaff, requireUser } from "@/server/rbac";
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

const manualSchema = z.object({
  userId: z.string(),
  status: z.enum(["PRESENT", "ABSENT", "LATE", "GUEST", "EXCUSED"]),
  day: z.string().optional(),
  note: z.string().optional()
});

export const POST = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id } = await params;
  await requireStaff(id, user);
  const input = await parseBody(req, manualSchema);
  return ok(await attendance.markManual(id, user, input));
});

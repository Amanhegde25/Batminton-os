import { handler, ok, parseBody } from "@/lib/api";
import { z } from "zod";
import { currentUser } from "@/server/auth/session";
import { getClubContext, isStaffOf, requireStaff, requireUser } from "@/server/rbac";
import { issueManual, listPenalties } from "@/server/services/penalties";

export const GET = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id } = await params;
  const staff = await isStaffOf(id, user);
  await getClubContext(id, user);
  const url = new URL(req.url);
  const requestedUser = url.searchParams.get("userId");
  return ok(
    await listPenalties(id, {
      userId: staff && requestedUser ? requestedUser : staff ? undefined : user.id,
      page: Number(url.searchParams.get("page") ?? 1)
    })
  );
});

const issueSchema = z.object({
  userId: z.string(),
  eventType: z.enum(["ABSENCE", "LATE", "LOSS", "WALKOVER", "CUSTOM"]),
  label: z.string().max(80).optional(),
  amount: z.number().int().min(1).max(100000).optional(),
  reason: z.string().max(200).optional()
});

export const POST = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id } = await params;
  await requireStaff(id, user);
  const input = await parseBody(req, issueSchema);
  return ok(await issueManual(id, user, input));
});

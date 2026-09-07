import { ApiError, handler, ok, parseBody } from "@/lib/api";
import { z } from "zod";
import { currentUser } from "@/server/auth/session";
import { getClubContext, isStaffOf, requireStaff, requireUser } from "@/server/rbac";
import { clubBalances, listClubTransactions, manualAdjust, refundTransaction } from "@/server/services/wallets";

export const GET = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id } = await params;
  const url = new URL(req.url);
  const staff = await isStaffOf(id, user);

  if (url.searchParams.get("view") === "balances") {
    await getClubContext(id, user);
    return ok(await clubBalances(id));
  }

  const requestedUser = url.searchParams.get("userId");
  const targetUser = staff && requestedUser ? requestedUser : user.id;
  return ok(
    await listClubTransactions(id, {
      userId: targetUser,
      type: url.searchParams.get("type") ?? undefined,
      page: Number(url.searchParams.get("page") ?? 1),
      pageSize: Number(url.searchParams.get("pageSize") ?? 25)
    })
  );
});

const adjustSchema = z.object({
  userId: z.string(),
  amount: z.number().int().refine((n) => n !== 0),
  type: z.enum(["MANUAL_CREDIT", "MANUAL_DEBIT", "OPENING_CREDIT", "OTHER"]).default("MANUAL_CREDIT"),
  description: z.string().min(2).max(200)
});

export const POST = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id } = await params;
  await requireStaff(id, user);
  const input = await parseBody(req, adjustSchema);
  return ok(await manualAdjust(id, user, input));
});

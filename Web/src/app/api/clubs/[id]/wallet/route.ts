import { handler, ok } from "@/lib/api";
import { currentUser } from "@/server/auth/session";
import { getClubContext, isStaffOf, requireUser } from "@/server/rbac";
import { getMyWallet } from "@/server/services/wallets";

export const GET = handler(async (_req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id } = await params;
  await getClubContext(id, user);
  return ok(await getMyWallet(id, user.id));
});

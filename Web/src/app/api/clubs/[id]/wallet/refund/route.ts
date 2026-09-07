import { handler, ok, parseBody } from "@/lib/api";
import { z } from "zod";
import { currentUser } from "@/server/auth/session";
import { requireStaff, requireUser } from "@/server/rbac";
import { refundTransaction } from "@/server/services/wallets";

const schema = z.object({ transactionId: z.string(), reason: z.string().max(200).optional() });

export const POST = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id } = await params;
  await requireStaff(id, user);
  const input = await parseBody(req, schema);
  return ok(await refundTransaction(id, user, input.transactionId, input.reason));
});

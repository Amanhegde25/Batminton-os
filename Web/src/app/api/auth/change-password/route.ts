import { handler, ok, parseBody } from "@/lib/api";
import { z } from "zod";
import { clearSession, currentUser } from "@/server/auth/session";
import { requireUser } from "@/server/rbac";
import { changePassword } from "@/server/services/users";

const schema = z.object({
  currentPassword: z.string().nullable().default(null),
  newPassword: z.string().min(8)
});

export const POST = handler(async (req) => {
  const user = await requireUser(await currentUser());
  const input = await parseBody(req, schema);
  await changePassword(user.id, input.currentPassword, input.newPassword);
  return clearSession(ok({ changed: true }));
});

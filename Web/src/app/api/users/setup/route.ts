import { handler, ok, parseBody } from "@/lib/api";
import { z } from "zod";
import { currentUser, attachSession } from "@/server/auth/session";
import { requireUser } from "@/server/rbac";
import { completeSetup } from "@/server/services/users";

const schema = z.object({
  email: z.string().optional().or(z.literal("")),
  mobile: z.string().optional().or(z.literal("")),
  aadhar: z.string().optional().or(z.literal("")),
  skip: z.boolean().optional()
});

export const POST = handler(async (req) => {
  const user = await requireUser(await currentUser(req));
  const body = await parseBody(req, schema);
  const updatedUser = await completeSetup(user.id, {
    email: body.email && body.email.trim() ? body.email.trim() : undefined,
    mobile: body.mobile && body.mobile.trim() ? body.mobile.trim() : undefined,
    aadhar: body.aadhar && body.aadhar.trim() ? body.aadhar.trim() : undefined,
    skip: body.skip
  });
  return attachSession(ok({ user: updatedUser }), updatedUser);
});

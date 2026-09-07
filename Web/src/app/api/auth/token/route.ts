import { ApiError, getIp, handler, ok, parseBody } from "@/lib/api";
import { z } from "zod";
import { rateLimit } from "@/server/rate-limit";
import { authenticate } from "@/server/services/users";
import { currentUser, createSessionToken } from "@/server/auth/session";
import { requireUser } from "@/server/rbac";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const GET = handler(async (req) => {
  const user = await requireUser(await currentUser(req));
  return ok({ user });
});

export const POST = handler(async (req) => {
  if (!rateLimit(`token:${getIp(req)}`, 10, 60_000)) throw ApiError.tooMany();
  const { email, password } = await parseBody(req, schema);
  const user = await authenticate(email, password);
  const token = createSessionToken(user);
  return ok({ user, token });
});

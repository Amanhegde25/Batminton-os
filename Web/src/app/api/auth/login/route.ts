import { ApiError, getIp, handler, ok, parseBody } from "@/lib/api";
import { z } from "zod";
import { rateLimit } from "@/server/rate-limit";
import { authenticate } from "@/server/services/users";
import { attachSession, createSessionToken } from "@/server/auth/session";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const POST = handler(async (req) => {
  if (!rateLimit(`login:${getIp(req)}`, 15, 60_000)) throw ApiError.tooMany();
  const { email, password } = await parseBody(req, schema);
  const user = await authenticate(email, password);
  const token = createSessionToken(user);
  return attachSession(ok({ user, token }), user);
});


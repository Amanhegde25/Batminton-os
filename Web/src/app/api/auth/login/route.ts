import { ApiError, getIp, handler, ok, parseBody } from "@/lib/api";
import { z } from "zod";
import { rateLimit } from "@/server/rate-limit";
import { authenticate } from "@/server/services/users";
import { attachSession, createSessionToken } from "@/server/auth/session";

const schema = z
  .object({
    email: z.string().optional(),
    mobile: z.string().optional(),
    identifier: z.string().optional(),
    password: z.string().min(1)
  })
  .refine(
    (data) =>
      Boolean(
        (data.identifier && data.identifier.trim()) ||
          (data.email && data.email.trim()) ||
          (data.mobile && data.mobile.trim())
      ),
    {
      message: "Email or mobile number is required"
    }
  );

export const POST = handler(async (req) => {
  if (!rateLimit(`login:${getIp(req)}`, 15, 60_000)) throw ApiError.tooMany();
  const body = await parseBody(req, schema);
  const identifier = (body.identifier || body.email || body.mobile)!.trim();
  const user = await authenticate(identifier, body.password);
  const token = createSessionToken(user);
  return attachSession(ok({ user, token }), user);
});

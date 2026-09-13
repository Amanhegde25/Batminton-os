import { ApiError, getIp, handler, parseBody, ok } from "@/lib/api";
import { z } from "zod";
import { rateLimit } from "@/server/rate-limit";
import { registerUser } from "@/server/services/users";
import { attachSession } from "@/server/auth/session";

const schema = z
  .object({
    name: z.string().min(2).max(80),
    email: z.string().email().optional().or(z.literal("")),
    mobile: z.string().regex(/^\+?[0-9]{10,14}$/, "Please enter a valid mobile number (10-14 digits)").optional().or(z.literal("")),
    password: z.string().min(8).max(100),
    dob: z.string().optional(),
    gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional()
  })
  .refine((data) => Boolean((data.email && data.email.trim()) || (data.mobile && data.mobile.trim())), {
    message: "Either email or mobile number is required"
  });

export const POST = handler(async (req) => {
  if (!rateLimit(`register:${getIp(req)}`, 10, 60_000)) throw ApiError.tooMany();
  const input = await parseBody(req, schema);
  const user = await registerUser({
    name: input.name,
    email: input.email && input.email.trim() ? input.email.trim() : undefined,
    mobile: input.mobile && input.mobile.trim() ? input.mobile.trim() : undefined,
    password: input.password,
    dob: input.dob,
    gender: input.gender
  });
  return attachSession(ok({ user }, { status: 201 }), user);
});

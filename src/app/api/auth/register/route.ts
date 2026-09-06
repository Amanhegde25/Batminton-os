import { NextResponse } from "next/server";
import { ApiError, getIp, handler, parseBody, ok } from "@/lib/api";
import { z } from "zod";
import { rateLimit } from "@/server/rate-limit";
import { registerUser } from "@/server/services/users";
import { attachSession } from "@/server/auth/session";

const schema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  mobile: z.string().regex(/^\+?[0-9]{10,14}$/).optional(),
  password: z.string().min(8).max(100),
  dob: z.string().optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional()
});

export const POST = handler(async (req) => {
  if (!rateLimit(`register:${getIp(req)}`, 10, 60_000)) throw ApiError.tooMany();
  const input = await parseBody(req, schema);
  const user = await registerUser(input);
  return attachSession(ok({ user }, { status: 201 }), user);
});

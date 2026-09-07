import { ApiError, getIp, handler, ok, parseBody } from "@/lib/api";
import { z } from "zod";
import { rateLimit } from "@/server/rate-limit";
import { prisma } from "@/server/db";
import { sha256 } from "@/server/auth/tokens";
import { findOrCreateByMobile } from "@/server/services/users";
import { attachSession } from "@/server/auth/session";

const schema = z.object({
  mobile: z.string().regex(/^\+?[0-9]{10,14}$/),
  code: z.string().min(4).max(8)
});

export const POST = handler(async (req) => {
  if (!rateLimit(`otp-verify:${getIp(req)}`, 10, 300_000)) throw ApiError.tooMany();
  const { mobile, code } = await parseBody(req, schema);
  const otp = await prisma.otpCode.findFirst({
    where: { mobile, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" }
  });
  if (!otp) throw ApiError.badRequest("No active code. Request a new OTP.");
  if (otp.attempts >= 5) throw ApiError.tooMany("Too many wrong attempts. Request a new OTP.");
  if (otp.codeHash !== sha256(code)) {
    await prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    throw ApiError.badRequest("Incorrect code");
  }
  await prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
  const user = await findOrCreateByMobile(mobile);
  return attachSession(ok({ user }), user);
});

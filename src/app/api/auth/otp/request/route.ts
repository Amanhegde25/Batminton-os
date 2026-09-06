import { ApiError, getIp, handler, ok, parseBody } from "@/lib/api";
import { z } from "zod";
import { rateLimit } from "@/server/rate-limit";
import { prisma } from "@/server/db";
import { env } from "@/lib/env";
import { sha256 } from "@/server/auth/tokens";

const schema = z.object({ mobile: z.string().regex(/^\+?[0-9]{10,14}$/) });

export const POST = handler(async (req) => {
  if (!rateLimit(`otp-req:${getIp(req)}`, 5, 300_000)) throw ApiError.tooMany();
  const { mobile } = await parseBody(req, schema);
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await prisma.otpCode.create({
    data: { mobile, codeHash: sha256(code), expiresAt: new Date(Date.now() + 5 * 60_000) }
  });
  if (env.otpProvider === "mock") {
    console.log(`[otp] mock provider — code for ${mobile}: ${code}`);
    return ok({ sent: true, provider: "mock", devCode: code });
  }
  throw ApiError.badRequest(
    `OTP provider '${env.otpProvider}' is not wired up yet. Set OTP_PROVIDER=mock or implement your SmsProvider (see docs/ARCHITECTURE.md).`
  );
});

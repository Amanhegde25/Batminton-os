import { ApiError, getIp, handler, ok, parseBody } from "@/lib/api";
import { z } from "zod";
import { rateLimit } from "@/server/rate-limit";
import { prisma } from "@/server/db";
import { randomToken, sha256 } from "@/server/auth/tokens";

const schema = z.object({ email: z.string().email() });

export const POST = handler(async (req) => {
  if (!rateLimit(`forgot:${getIp(req)}`, 5, 300_000)) throw ApiError.tooMany();
  const { email } = await parseBody(req, schema);
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (user && !user.deletedAt) {
    const token = randomToken(24);
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 30 * 60_000) }
    });
    return ok({
      message: "If the email exists, a reset link has been sent.",
      devResetPath: process.env.NODE_ENV !== "production" ? `/reset-password?token=${token}` : undefined
    });
  }
  return ok({ message: "If the email exists, a reset link has been sent." });
});

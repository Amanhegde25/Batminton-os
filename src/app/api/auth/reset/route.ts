import { ApiError, handler, ok, parseBody } from "@/lib/api";
import { z } from "zod";
import { prisma } from "@/server/db";
import { hashPassword } from "@/server/auth/password";
import { sha256 } from "@/server/auth/tokens";

const schema = z.object({ token: z.string().min(10), password: z.string().min(8).max(100) });

export const POST = handler(async (req) => {
  const { token, password } = await parseBody(req, schema);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) throw ApiError.badRequest("Invalid or expired reset link");
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash: hashPassword(password), tokenVersion: { increment: 1 } }
    }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } })
  ]);
  return ok({ reset: true });
});

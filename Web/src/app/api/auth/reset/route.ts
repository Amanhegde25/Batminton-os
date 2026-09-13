import { ApiError, handler, ok, parseBody } from "@/lib/api";
import { z } from "zod";
import { users, passwordResetTokens } from "@/server/db";
import { hashPassword } from "@/server/auth/password";
import { sha256 } from "@/server/auth/tokens";

const schema = z.object({ token: z.string().min(10), password: z.string().min(8).max(100) });

export const POST = handler(async (req) => {
  const { token, password } = await parseBody(req, schema);
  const record = await passwordResetTokens().findOne({ tokenHash: sha256(token) });
  if (!record || record.usedAt || (record.expiresAt as Date) < new Date()) {
    throw ApiError.badRequest("Invalid or expired reset link");
  }

  await users().updateOne(
    { id: record.userId },
    {
      $set: { passwordHash: hashPassword(password), updatedAt: new Date() },
      $inc: { tokenVersion: 1 }
    }
  );
  await passwordResetTokens().updateOne(
    { id: record.id },
    { $set: { usedAt: new Date() } }
  );

  return ok({ reset: true });
});

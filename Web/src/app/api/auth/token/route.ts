import { ApiError, getIp, handler, ok, parseBody } from "@/lib/api";
import { z } from "zod";
import { rateLimit } from "@/server/rate-limit";
import { authenticate } from "@/server/services/users";
import { signToken, randomToken, sha256 } from "@/server/auth/tokens";
import { prisma } from "@/server/db";

const ACCESS_TTL = 60 * 15; // 15 minutes
const REFRESH_TTL = 60 * 60 * 24 * 30; // 30 days

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const POST = handler(async (req) => {
  if (!rateLimit(`token:${getIp(req)}`, 10, 60_000)) throw ApiError.tooMany();
  const { email, password } = await parseBody(req, schema);
  const user = await authenticate(email, password);

  const accessToken = signToken(
    { sub: user.id, tv: user.tokenVersion, role: user.role, typ: "access" },
    ACCESS_TTL
  );
  const rawRefresh = randomToken();
  const refreshHash = sha256(rawRefresh);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: refreshHash,
      expiresAt: new Date(Date.now() + REFRESH_TTL * 1000),
    },
  });

  return ok({ accessToken, refreshToken: rawRefresh, user });
});

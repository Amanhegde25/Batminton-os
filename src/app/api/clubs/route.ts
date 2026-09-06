import { handler, ok, parseBody, getIp, ApiError } from "@/lib/api";
import { z } from "zod";
import { rateLimit } from "@/server/rate-limit";
import { currentUser } from "@/server/auth/session";
import { requireStaff, requireUser } from "@/server/rbac";
import { createClub, listPublicClubs } from "@/server/services/clubs";
import { prisma } from "@/server/db";

export const GET = handler(async (req) => {
  await requireUser(await currentUser());
  const q = new URL(req.url).searchParams.get("q") ?? undefined;
  return ok(await listPublicClubs(q || undefined));
});

const createSchema = z.object({
  name: z.string().min(3).max(80),
  description: z.string().max(500).optional(),
  city: z.string().max(80).optional(),
  address: z.string().max(200).optional(),
  logoUrl: z.string().max(500).optional(),
  lat: z.number().optional(),
  lng: z.number().optional()
});

export const POST = handler(async (req) => {
  const user = await requireUser(await currentUser());
  if (!rateLimit(`club-create:${getIp(req)}`, 5, 3600_000)) throw ApiError.tooMany();
  const input = await parseBody(req, createSchema);
  const club = await createClub(user, input);
  const full = await prisma.club.findUnique({ where: { id: club.id } });
  return ok({ club: full }, { status: 201 });
});

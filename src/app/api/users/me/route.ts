import { handler, ok, parseBody, ApiError } from "@/lib/api";
import { z } from "zod";
import { currentUser } from "@/server/auth/session";
import { requireUser } from "@/server/rbac";
import { getMe, updateProfile } from "@/server/services/users";

export const GET = handler(async () => {
  const user = await requireUser(await currentUser());
  return ok(await getMe(user));
});

const patchSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  photoUrl: z.string().max(500).optional(),
  mobile: z.string().regex(/^\+?[0-9]{10,14}$/).optional(),
  dob: z.string().optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  skillLevel: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "PROFESSIONAL"]).optional(),
  playingStyle: z.enum(["ATTACKING_SMASH", "DEFENSIVE_CLEAR", "ALL_ROUND", "NET_PLAYER", "DECEPTIVE"]).optional(),
  dominantHand: z.enum(["RIGHT", "LEFT"]).optional(),
  preferredTime: z.enum(["MORNING", "AFTERNOON", "EVENING", "NIGHT"]).optional()
});

export const PATCH = handler(async (req) => {
  const user = await requireUser(await currentUser());
  const patch = await parseBody(req, patchSchema);
  if (patch.mobile !== undefined && patch.mobile !== null && patch.mobile !== "") {
    const existing = await prismaSafe(patch.mobile, user.id);
    if (existing) throw ApiError.conflict("Mobile number already in use");
  }
  const updated = await updateProfile(user.id, patch);
  return ok({ user: updated });
});

async function prismaSafe(mobile: string, exceptUserId: string) {
  const { prisma } = await import("@/server/db");
  const found = await prisma.user.findUnique({ where: { mobile } });
  if (found && found.id === exceptUserId) return null;
  return found;
}

import { handler, ok, parseBody, ApiError } from "@/lib/api";
import { z } from "zod";
import { currentUser } from "@/server/auth/session";
import { requireUser } from "@/server/rbac";
import { getMe, updateProfile } from "@/server/services/users";
import { users } from "@/server/db";

export const GET = handler(async () => {
  const user = await requireUser(await currentUser());
  return ok(await getMe(user));
});

const patchSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  email: z.string().optional().nullable().or(z.literal("")),
  photoUrl: z.string().max(500).optional().nullable(),
  mobile: z.string().optional().nullable().or(z.literal("")),
  aadhar: z.string().optional().nullable().or(z.literal("")),
  dob: z.string().optional().nullable(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional().nullable(),
  skillLevel: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "PROFESSIONAL"]).optional().nullable(),
  playingStyle: z.enum(["ATTACKING_SMASH", "DEFENSIVE_CLEAR", "ALL_ROUND", "NET_PLAYER", "DECEPTIVE"]).optional().nullable(),
  dominantHand: z.enum(["RIGHT", "LEFT"]).optional().nullable(),
  preferredTime: z.enum(["MORNING", "AFTERNOON", "EVENING", "NIGHT"]).optional().nullable()
});

export const PATCH = handler(async (req) => {
  const user = await requireUser(await currentUser());
  const patch = await parseBody(req, patchSchema);
  const updated = await updateProfile(user.id, patch);
  return ok({ user: updated });
});

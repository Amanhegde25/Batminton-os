import { handler, ok, parseBody } from "@/lib/api";
import { z } from "zod";
import { currentUser } from "@/server/auth/session";
import { requireUser } from "@/server/rbac";
import { updateCoach, deleteCoach } from "@/server/services/coaching";

const updateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  title: z.string().max(100).optional(),
  bio: z.string().max(500).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional().or(z.literal("")),
  photoUrl: z.string().url().optional().or(z.literal("")),
  hourlyFee: z.number().min(0).optional(),
  pricing: z
    .object({
      BEGINNER: z.number().min(0).optional(),
      INTERMEDIATE: z.number().min(0).optional(),
      ADVANCED: z.number().min(0).optional()
    })
    .optional(),
  levels: z.array(z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"])).optional(),
  availableDays: z.array(z.string()).optional(),
  availableTimeSlots: z.array(z.string()).optional(),
  active: z.boolean().optional()
});

export const PATCH = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id: clubId, coachId } = await params;
  const body = await parseBody(req, updateSchema);
  const updated = await updateCoach(clubId, coachId, user, {
    ...body,
    email: body.email || undefined,
    photoUrl: body.photoUrl || undefined
  });
  return ok(updated);
});

export const DELETE = handler(async (_req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id: clubId, coachId } = await params;
  await deleteCoach(clubId, coachId, user);
  return ok({ deleted: true });
});

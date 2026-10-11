import { handler, ok, parseBody } from "@/lib/api";
import { z } from "zod";
import { currentUser } from "@/server/auth/session";
import { requireUser } from "@/server/rbac";
import { listCoaches, createCoach } from "@/server/services/coaching";

export const GET = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id: clubId } = await params;
  const url = new URL(req.url);
  const onlyActive = url.searchParams.get("onlyActive") === "true";
  const items = await listCoaches(clubId, onlyActive);
  return ok({ items });
});

const createSchema = z.object({
  name: z.string().min(2).max(100),
  title: z.string().max(100).optional(),
  bio: z.string().max(500).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional().or(z.literal("")),
  photoUrl: z.string().url().optional().or(z.literal("")),
  hourlyFee: z.number().min(0).optional(),
  availableDays: z.array(z.string()).optional(),
  availableTimeSlots: z.array(z.string()).optional()
});

export const POST = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id: clubId } = await params;
  const body = await parseBody(req, createSchema);
  const coach = await createCoach(clubId, user, {
    ...body,
    email: body.email || undefined,
    photoUrl: body.photoUrl || undefined
  });
  return ok(coach);
});

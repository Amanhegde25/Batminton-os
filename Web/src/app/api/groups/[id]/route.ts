import { ApiError, handler, ok, parseBody } from "@/lib/api";
import { currentUser } from "@/server/auth/session";
import { requireGroupLeader, requireUser } from "@/server/rbac";
import { getGroup, updateGroup } from "@/server/services/groups";
import { playGroups } from "@/server/db";
import { z } from "zod";

export const GET = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser(req));
  const { id } = await params;
  const group = await getGroup(id, user.id);
  return ok(group);
});

const patchSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  description: z.string().max(500).optional(),
  city: z.string().max(60).optional(),
  skillLevel: z.string().optional(),
  isPublic: z.boolean().optional(),
  logoUrl: z.string().url().optional().or(z.literal(""))
});

export const PATCH = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser(req));
  const { id } = await params;
  const body = await parseBody(req, patchSchema);
  const updated = await updateGroup(id, user.id, body);
  return ok(updated);
});

export const DELETE = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser(req));
  const { id } = await params;
  await requireGroupLeader(id, user.id);

  await playGroups().updateOne({ id }, { $set: { deletedAt: new Date() } });

  return ok({ success: true });
});

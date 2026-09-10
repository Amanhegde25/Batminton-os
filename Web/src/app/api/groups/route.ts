import { handler, ok, parseBody } from "@/lib/api";
import { currentUser } from "@/server/auth/session";
import { requireUser } from "@/server/rbac";
import { createGroup, listGroups } from "@/server/services/groups";
import { z } from "zod";

export const GET = handler(async (req) => {
  const user = await requireUser(await currentUser(req));
  const url = new URL(req.url);
  const city = url.searchParams.get("city") ?? undefined;
  const q = url.searchParams.get("q") ?? undefined;
  const myOnly = url.searchParams.get("myOnly") === "true";

  const groups = await listGroups(user.id, { city, q, myOnly });
  return ok(groups);
});

const createGroupSchema = z.object({
  name: z.string().min(3).max(60),
  description: z.string().max(500).optional(),
  city: z.string().max(80).optional(),
  skillLevel: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "ALL"]).optional(),
  isPublic: z.boolean().optional(),
  logoUrl: z.string().url().max(500).optional()
});

export const POST = handler(async (req) => {
  const user = await requireUser(await currentUser(req));
  const input = await parseBody(req, createGroupSchema);
  const group = await createGroup(user.id, input);
  return ok(group, { status: 201 });
});

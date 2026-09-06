import { handler, ok, parseBody } from "@/lib/api";
import { z } from "zod";
import { currentUser } from "@/server/auth/session";
import { requireStaff, requireUser } from "@/server/rbac";
import { deleteRule, listRules, upsertRule } from "@/server/services/penalties";

export const GET = handler(async (_req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id } = await params;
  await requireStaff(id, user);
  return ok(await listRules(id));
});

const upsertSchema = z.object({
  eventType: z.enum(["ABSENCE", "LATE", "LOSS", "WALKOVER", "CUSTOM"]),
  label: z.string().min(2).max(80),
  amount: z.number().int().min(0).max(100000),
  enabled: z.boolean().default(true)
});

export const POST = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id } = await params;
  await requireStaff(id, user);
  const input = await parseBody(req, upsertSchema);
  return ok(await upsertRule(id, user, input));
});

const deleteSchema = z.object({ ruleId: z.string() });

export const DELETE = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id } = await params;
  await requireStaff(id, user);
  const parsed = deleteSchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  const input = parsed.success ? parsed.data : await parseBody(req, deleteSchema);
  return ok(await deleteRule(id, user, input.ruleId));
});

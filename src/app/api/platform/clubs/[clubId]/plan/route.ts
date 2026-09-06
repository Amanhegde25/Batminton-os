import { handler, ok, parseBody } from "@/lib/api";
import { z } from "zod";
import { currentUser } from "@/server/auth/session";
import { requireSuperAdmin } from "@/server/rbac";
import { changePlan } from "@/server/services/platform";

const schema = z.object({ plan: z.enum(["FREE", "PRO", "PREMIUM"]) });

export const PATCH = handler(async (req, { params }) => {
  const admin = await requireSuperAdmin(await currentUser());
  const { clubId } = await params as { clubId: string };
  const input = await parseBody(req, schema);
  return ok(await changePlan(clubId, input.plan, admin.id));
});

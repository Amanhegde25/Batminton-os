import { handler, ok, parseBody } from "@/lib/api";
import { z } from "zod";
import { currentUser } from "@/server/auth/session";
import { assertFeature, getClubContext, requireManagerOrCoach, requireUser } from "@/server/rbac";
import { FEATURES } from "@/lib/constants";
import { applySchedule, previewWithMeta } from "@/server/services/matchmaking";

export const GET = handler(async (_req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id } = await params;
  const ctx = await getClubContext(id, user);
  await assertFeature(ctx.club, FEATURES.MATCHMAKING);
  return ok(await previewWithMeta(id, "DOUBLES"));
});

const schema = z.object({
  mode: z.enum(["SINGLES", "DOUBLES"]).default("DOUBLES"),
  apply: z.boolean().default(false)
});

export const POST = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id } = await params;
  const ctx = await getClubContext(id, user);
  await assertFeature(ctx.club, FEATURES.MATCHMAKING);
  const input = await parseBody(req, schema);
  if (input.apply) {
    await requireManagerOrCoach(id, user);
    return ok(await applySchedule(id, user, input.mode));
  }
  return ok(await previewWithMeta(id, input.mode));
});

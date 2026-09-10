import { handler, ok, parseBody } from "@/lib/api";
import { z } from "zod";
import { currentUser } from "@/server/auth/session";
import { assertFeature, getClubContext, requireManagerOrCoach, requireUser } from "@/server/rbac";
import { FEATURES } from "@/lib/constants";
import { applySchedule, previewWithMeta } from "@/server/services/matchmaking";

export const GET = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id } = await params;
  const ctx = await getClubContext(id, user);
  await assertFeature(ctx.club, FEATURES.MATCHMAKING);

  const url = new URL(req.url);
  const mode = (url.searchParams.get("mode") === "SINGLES" ? "SINGLES" : "DOUBLES") as "SINGLES" | "DOUBLES";
  const includeAbsent = url.searchParams.get("includeAbsent") === "true";
  const extraParam = url.searchParams.get("extraPlayerIds");
  const extraPlayerIds = extraParam ? extraParam.split(",").filter(Boolean) : undefined;

  return ok(await previewWithMeta(id, mode, { includeAbsent, extraPlayerIds }));
});

const schema = z.object({
  mode: z.enum(["SINGLES", "DOUBLES"]).default("DOUBLES"),
  apply: z.boolean().default(false),
  includeAbsent: z.boolean().optional(),
  extraPlayerIds: z.array(z.string()).optional()
});

export const POST = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id } = await params;
  const ctx = await getClubContext(id, user);
  await assertFeature(ctx.club, FEATURES.MATCHMAKING);
  const input = await parseBody(req, schema);

  const options = {
    includeAbsent: input.includeAbsent,
    extraPlayerIds: input.extraPlayerIds
  };

  if (input.apply) {
    await requireManagerOrCoach(id, user);
    return ok(await applySchedule(id, user, input.mode, options));
  }
  return ok(await previewWithMeta(id, input.mode, options));
});

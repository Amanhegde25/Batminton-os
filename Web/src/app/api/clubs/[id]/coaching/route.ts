import { handler, ok } from "@/lib/api";
import { currentUser } from "@/server/auth/session";
import { assertFeature, getClubContext, requireUser } from "@/server/rbac";
import { FEATURES } from "@/lib/constants";
import { getCoaching, regenerateCoaching } from "@/server/services/ai";

export const GET = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id } = await params;
  const ctx = await getClubContext(id, user);
  await assertFeature(ctx.club, FEATURES.AI_COACHING);
  const url = new URL(req.url);
  const requested = url.searchParams.get("userId");
  const staff = ["OWNER", "ADMIN", "COACH"].includes(ctx.membership?.role ?? "");
  const target = requested && staff ? requested : user.id;
  return ok(await getCoaching(id, target));
});

export const POST = handler(async (_req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id } = await params;
  const ctx = await getClubContext(id, user);
  await assertFeature(ctx.club, FEATURES.AI_COACHING);
  return ok(await regenerateCoaching(id, user.id));
});

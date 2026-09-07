import { handler, ok } from "@/lib/api";
import { currentUser } from "@/server/auth/session";
import { getClubContext, requireUser } from "@/server/rbac";
import { getPlayerRatingCard } from "@/server/services/rating";

export const GET = handler(async (_req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id, userId } = await params as { id: string; userId: string };
  await getClubContext(id, user);
  return ok(await getPlayerRatingCard(id, userId));
});

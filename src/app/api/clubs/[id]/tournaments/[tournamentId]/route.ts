import { handler, ok } from "@/lib/api";
import { currentUser } from "@/server/auth/session";
import { getClubContext, requireUser } from "@/server/rbac";
import { detail } from "@/server/services/tournaments";

export const GET = handler(async (_req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id, tournamentId } = await params as { id: string; tournamentId: string };
  await getClubContext(id, user);
  return ok(await detail(id, tournamentId));
});

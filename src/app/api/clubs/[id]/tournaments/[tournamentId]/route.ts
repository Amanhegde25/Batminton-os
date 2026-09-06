import { handler, ok } from "@/lib/api";
import { currentUser } from "@/server/auth/session";
import { getClubContext, requireUser } from "@/server/rbac";
import { detail } from "@/server/services/tournaments";

async function resolveClubId(id: string, tournamentId: string): Promise<string> {
  if (id && id !== "_" && id !== "undefined") return id;
  const { prisma } = await import("@/server/db");
  const t = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (t) return t.clubId;
  return id;
}

export const GET = handler(async (_req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id: rawId, tournamentId } = (await params) as { id: string; tournamentId: string };
  const id = await resolveClubId(rawId, tournamentId);
  await getClubContext(id, user);
  return ok(await detail(id, tournamentId));
});

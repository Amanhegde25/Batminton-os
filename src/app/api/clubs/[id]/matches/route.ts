import { handler, ok, parseBody } from "@/lib/api";
import { z } from "zod";
import { currentUser } from "@/server/auth/session";
import { getClubContext, requireManagerOrCoach, requireUser } from "@/server/rbac";
import { createMatch, listMatches } from "@/server/services/matches";

export const GET = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id } = await params;
  await getClubContext(id, user);
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  return ok(
    await listMatches(id, {
      status: status ? status.split(",") : undefined,
      userId: url.searchParams.get("userId") ?? undefined,
      day: url.searchParams.get("day") ?? undefined,
      tournamentId: url.searchParams.get("tournamentId") ?? undefined,
      page: Number(url.searchParams.get("page") ?? 1)
    })
  );
});

const createSchema = z.object({
  type: z.enum(["SINGLES", "DOUBLES"]),
  teamAUserIds: z.array(z.string()).min(1).max(2),
  teamBUserIds: z.array(z.string()).min(1).max(2),
  courtId: z.string().optional(),
  scheduledAt: z.string().optional(),
  notes: z.string().max(200).optional()
});

export const POST = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id } = await params;
  await requireManagerOrCoach(id, user);
  const input = await parseBody(req, createSchema);
  return ok(
    await createMatch(id, user, {
      type: input.type,
      teamAUserIds: input.teamAUserIds,
      teamBUserIds: input.teamBUserIds,
      courtId: input.courtId ?? null,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : new Date(),
      notes: input.notes ?? null
    }),
    { status: 201 }
  );
});

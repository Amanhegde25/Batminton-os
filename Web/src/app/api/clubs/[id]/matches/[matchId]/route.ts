import { handler, ok, parseBody } from "@/lib/api";
import { z } from "zod";
import { currentUser } from "@/server/auth/session";
import { getClubContext, requireManagerOrCoach, requireUser } from "@/server/rbac";
import {
  cancelMatch,
  completeMatch,
  editMatch,
  enterScores,
  getMatch,
  startMatch
} from "@/server/services/matches";

async function resolveClubId(id: string, matchId: string): Promise<string> {
  if (id && id !== "_" && id !== "undefined") return id;
  const { prisma } = await import("@/server/db");
  const m = await prisma.match.findUnique({ where: { id: matchId } });
  if (m) return m.clubId;
  return id;
}

export const GET = handler(async (_req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id: rawId, matchId } = (await params) as { id: string; matchId: string };
  const id = await resolveClubId(rawId, matchId);
  await getClubContext(id, user);
  return ok(await getMatch(id, matchId));
});

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start") }),
  z.object({
    action: z.literal("score"),
    sets: z.array(z.object({ a: z.number().int().min(0).max(30), b: z.number().int().min(0).max(30) })).max(3)
  }),
  z.object({
    action: z.literal("complete"),
    sets: z.array(z.object({ a: z.number().int().min(0).max(30), b: z.number().int().min(0).max(30) })).max(3).optional()
  }),
  z.object({ action: z.literal("walkover"), winnerTeamIndex: z.number().int().min(0).max(1) }),
  z.object({ action: z.literal("cancel") })
]);

export const POST = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id: rawId, matchId } = (await params) as { id: string; matchId: string };
  const id = await resolveClubId(rawId, matchId);
  await requireManagerOrCoach(id, user);
  const input = await parseBody(req, actionSchema);

  switch (input.action) {
    case "start":
      return ok(await startMatch(id, matchId));
    case "score":
      return ok(await enterScores(id, matchId, input.sets));
    case "complete":
      return ok(await completeMatch(id, matchId, user, { sets: input.sets }));
    case "walkover":
      return ok(await completeMatch(id, matchId, user, { walkoverWinnerTeamIndex: input.winnerTeamIndex }));
    case "cancel":
      return ok(await cancelMatch(id, matchId, user));
  }
});

const patchSchema = z.object({
  teamAUserIds: z.array(z.string()).optional(),
  teamBUserIds: z.array(z.string()).optional(),
  courtId: z.string().nullable().optional(),
  scheduledAt: z.string().nullable().optional(),
  notes: z.string().nullable().optional()
});

export const PATCH = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id, matchId } = await params as { id: string; matchId: string };
  await requireManagerOrCoach(id, user);
  const input = await parseBody(req, patchSchema);
  return ok(
    await editMatch(id, matchId, user, {
      ...input,
      courtId: input.courtId === undefined ? undefined : input.courtId,
      scheduledAt:
        input.scheduledAt === undefined ? undefined : input.scheduledAt === null ? null : new Date(input.scheduledAt)
    })
  );
});

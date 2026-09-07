import { handler, ok, parseBody } from "@/lib/api";
import { z } from "zod";
import { currentUser } from "@/server/auth/session";
import { getClubContext, requireStaff, requireUser } from "@/server/rbac";
import { createTournament, listTournaments, registerParticipant, startTournament, submitScore } from "@/server/services/tournaments";

export const GET = handler(async (_req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id } = await params;
  await getClubContext(id, user);
  return ok(await listTournaments(id));
});

const createSchema = z.object({
  name: z.string().min(3).max(80),
  size: z.union([z.literal(4), z.literal(8), z.literal(16), z.literal(32)]),
  fee: z.number().int().min(0).optional(),
  startsAt: z.string().optional()
});

export const POST = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id } = await params;
  await requireStaff(id, user);
  const input = await parseBody(req, createSchema);
  return ok(
    await createTournament(id, user, {
      name: input.name,
      size: input.size,
      fee: input.fee,
      startsAt: input.startsAt ? new Date(input.startsAt) : null
    }),
    { status: 201 }
  );
});

async function resolveClubId(id: string, tournamentId?: string): Promise<string> {
  if (id && id !== "_" && id !== "undefined") return id;
  if (tournamentId) {
    const { prisma } = await import("@/server/db");
    const t = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (t) return t.clubId;
  }
  return id;
}

export const PATCH = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id: rawId } = await params;
  const body = await parseBody(
    req,
    z.discriminatedUnion("action", [
      z.object({ action: z.literal("register"), tournamentId: z.string(), forUserId: z.string().optional() }),
      z.object({ action: z.literal("start"), tournamentId: z.string() }),
      z.object({ action: z.literal("score"), tournamentId: z.string(), matchId: z.string(), setsText: z.string() })
    ])
  );
  const id = await resolveClubId(rawId, body.tournamentId);
  switch (body.action) {
    case "register": {
      await getClubContext(id, user);
      return ok(await registerParticipant(id, body.tournamentId, user, body.forUserId));
    }
    case "start": {
      await requireStaff(id, user);
      return ok(await startTournament(id, body.tournamentId, user));
    }
    case "score": {
      await requireStaff(id, user);
      return ok(await submitScore(id, body.tournamentId, body.matchId, user, body.setsText));
    }
  }
});

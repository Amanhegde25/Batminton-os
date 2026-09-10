import { handler, ok, parseBody } from "@/lib/api";
import { currentUser } from "@/server/auth/session";
import { requireUser } from "@/server/rbac";
import { createGroupSession } from "@/server/services/groups";
import { prisma } from "@/server/db";
import { z } from "zod";

export const GET = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser(req));
  const { id } = await params;
  const sessions = await prisma.playGroupSession.findMany({
    where: { groupId: id },
    orderBy: { scheduledDate: "asc" },
    include: {
      club: { select: { id: true, name: true, city: true, address: true, logoUrl: true } },
      rsvps: {
        include: {
          user: { select: { id: true, name: true, photoUrl: true } }
        }
      }
    }
  });
  return ok(sessions);
});

const createSessionSchema = z.object({
  title: z.string().min(2).max(100),
  clubId: z.string().optional(),
  clubName: z.string().max(100).optional(),
  clubAddress: z.string().max(200).optional(),
  scheduledDate: z.string().datetime().or(z.string().min(10)),
  durationMinutes: z.number().int().min(15).max(480).optional(),
  maxPlayers: z.number().int().min(2).max(30).optional(),
  costPerPlayer: z.number().int().min(0).optional(),
  notes: z.string().max(500).optional()
});

export const POST = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser(req));
  const { id } = await params;
  const input = await parseBody(req, createSessionSchema);
  const session = await createGroupSession(id, user.id, input);
  return ok(session, { status: 201 });
});

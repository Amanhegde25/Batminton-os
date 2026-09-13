import { handler, ok, parseBody } from "@/lib/api";
import { currentUser } from "@/server/auth/session";
import { requireUser } from "@/server/rbac";
import { createGroupSession } from "@/server/services/groups";
import { playGroupSessions, playGroupSessionRsvps, clubs, users } from "@/server/db";
import { z } from "zod";

export const GET = handler(async (req, { params }) => {
  await requireUser(await currentUser(req));
  const { id } = await params;
  const sessions = await playGroupSessions()
    .find({ groupId: id })
    .sort({ scheduledDate: 1 })
    .toArray();

  const sessionIds = sessions.map((s) => s.id as string);
  const clubIds = sessions.map((s) => s.clubId as string).filter(Boolean);

  const [clubDocs, rsvpDocs] = await Promise.all([
    clubIds.length > 0
      ? clubs().find({ id: { $in: clubIds } }, { projection: { id: 1, name: 1, city: 1, address: 1, logoUrl: 1 } }).toArray()
      : [],
    sessionIds.length > 0
      ? playGroupSessionRsvps().find({ sessionId: { $in: sessionIds } }).toArray()
      : []
  ]);

  const rsvpUserIds = Array.from(new Set(rsvpDocs.map((r) => r.userId as string)));
  const rsvpUsers = rsvpUserIds.length > 0
    ? await users().find({ id: { $in: rsvpUserIds } }, { projection: { id: 1, name: 1, photoUrl: 1 } }).toArray()
    : [];

  const clubMap = new Map(clubDocs.map((c) => [c.id as string, c]));
  const userMap = new Map(rsvpUsers.map((u) => [u.id as string, u]));

  const rsvpsBySession = new Map<string, any[]>();
  for (const r of rsvpDocs) {
    const sid = r.sessionId as string;
    const list = rsvpsBySession.get(sid) || [];
    list.push({
      ...r,
      user: userMap.get(r.userId as string) || null
    });
    rsvpsBySession.set(sid, list);
  }

  const result = sessions.map((s) => ({
    ...s,
    club: s.clubId ? clubMap.get(s.clubId as string) || null : null,
    rsvps: rsvpsBySession.get(s.id as string) || []
  }));

  return ok(result);
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

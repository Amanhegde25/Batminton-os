import { handler, ok, parseBody } from "@/lib/api";
import { currentUser } from "@/server/auth/session";
import { requireUser } from "@/server/rbac";
import { rsvpSession } from "@/server/services/groups";
import { z } from "zod";

const rsvpSchema = z.object({
  status: z.enum(["YES", "MAYBE", "NO"])
});

export const POST = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser(req));
  const { sessionId } = await params;
  const input = await parseBody(req, rsvpSchema);
  const rsvp = await rsvpSession(sessionId, user.id, input.status);
  return ok(rsvp);
});

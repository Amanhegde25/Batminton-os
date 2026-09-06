import { handler, ok, parseBody } from "@/lib/api";
import { z } from "zod";
import { currentUser } from "@/server/auth/session";
import { requireManagerOrCoach, requireStaff, requireUser } from "@/server/rbac";
import { addMember, approveMembership, changeRole, listMembers } from "@/server/services/members";

export const GET = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id } = await params;
  await requireManagerOrCoach(id, user);
  const q = new URL(req.url).searchParams.get("q") ?? undefined;
  return ok(await listMembers(id, q || undefined));
});

const addSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(80).optional(),
  role: z.enum(["ADMIN", "COACH", "PLAYER"]).optional()
});

export const POST = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id } = await params;
  const action = new URL(req.url).searchParams.get("action");

  if (action === "approve" || action === "reject") {
    await requireStaff(id, user);
    const body = await parseBody(req, z.object({ memberId: z.string() }));
    return ok(await approveMembership(id, user, body.memberId, action === "approve"));
  }

  const ctx = await requireManagerOrCoach(id, user);
  const input = await parseBody(req, addSchema);
  if ((input.role === "ADMIN") && !["OWNER", "ADMIN"].includes(ctx.membership?.role ?? "")) {
    return ok(await addMember(id, user, { ...input, role: "PLAYER" }));
  }
  return ok(await addMember(id, user, input));
});

const patchSchema = z.object({ memberId: z.string(), role: z.enum(["OWNER", "ADMIN", "COACH", "PLAYER"]) });

export const PATCH = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id } = await params;
  await requireManagerOrCoach(id, user);
  const input = await parseBody(req, patchSchema);
  return ok(await changeRole(id, user, input.memberId, input.role));
});

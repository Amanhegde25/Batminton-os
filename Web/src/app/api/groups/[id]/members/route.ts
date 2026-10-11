import { handler, ok } from "@/lib/api";
import { currentUser } from "@/server/auth/session";
import { requireUser } from "@/server/rbac";
import { joinGroup, leaveGroup, listGroupMembers } from "@/server/services/groups";

export const GET = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser(req));
  const { id } = await params;
  const members = await listGroupMembers(id, user.id);
  return ok(members);
});

export const POST = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser(req));
  const { id } = await params;
  const member = await joinGroup(id, user.id);
  return ok(member, { status: 201 });
});

export const DELETE = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser(req));
  const { id } = await params;
  const result = await leaveGroup(id, user.id);
  return ok(result);
});

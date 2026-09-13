import { ApiError, handler, ok } from "@/lib/api";
import { currentUser } from "@/server/auth/session";
import { requireUser } from "@/server/rbac";
import { getGroup } from "@/server/services/groups";
import { playGroups, playGroupMembers } from "@/server/db";

export const GET = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser(req));
  const { id } = await params;
  const group = await getGroup(id, user.id);
  return ok(group);
});

export const DELETE = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser(req));
  const { id } = await params;
  const member = await playGroupMembers().findOne({ groupId: id, userId: user.id });
  if (!member || member.role !== "LEADER") {
    throw ApiError.forbidden("Only group leaders can delete this group");
  }

  await playGroups().updateOne({ id }, { $set: { deletedAt: new Date() } });

  return ok({ success: true });
});

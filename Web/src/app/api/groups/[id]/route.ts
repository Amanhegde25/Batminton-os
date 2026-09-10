import { ApiError, handler, ok } from "@/lib/api";
import { currentUser } from "@/server/auth/session";
import { requireUser } from "@/server/rbac";
import { getGroup } from "@/server/services/groups";
import { prisma } from "@/server/db";

export const GET = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser(req));
  const { id } = await params;
  const group = await getGroup(id, user.id);
  return ok(group);
});

export const DELETE = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser(req));
  const { id } = await params;
  const member = await prisma.playGroupMember.findUnique({
    where: { groupId_userId: { groupId: id, userId: user.id } }
  });
  if (!member || member.role !== "LEADER") {
    throw ApiError.forbidden("Only group leaders can delete this group");
  }

  await prisma.playGroup.update({
    where: { id },
    data: { deletedAt: new Date() }
  });

  return ok({ success: true });
});

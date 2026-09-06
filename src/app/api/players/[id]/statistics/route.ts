import { ApiError, handler, ok } from "@/lib/api";
import { currentUser } from "@/server/auth/session";
import { requireUser } from "@/server/rbac";
import { playerStatistics } from "@/server/services/analytics";
import { prisma } from "@/server/db";

export const GET = handler(async (req, { params }) => {
  const requester = await requireUser(await currentUser());
  const { id: userId } = await params as { id: string };
  const clubId = new URL(req.url).searchParams.get("clubId");
  if (!clubId) throw ApiError.badRequest("clubId query param is required");

  const targetMembership = await prisma.clubMember.findUnique({
    where: { clubId_userId: { clubId, userId } }
  });
  if (!targetMembership || targetMembership.status !== "ACTIVE") {
    throw ApiError.notFound("Player not found in this club");
  }
  if (requester.id !== userId && requester.role !== "SUPER_ADMIN") {
    const requesterMembership = await prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId: requester.id } }
    });
    if (!requesterMembership || requesterMembership.status !== "ACTIVE") {
      throw ApiError.forbidden("Join this club to view player analytics", "NOT_A_MEMBER");
    }
  }
  return ok(await playerStatistics(clubId, userId));
});

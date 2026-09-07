import { prisma } from "@/server/db";
import { ApiError } from "@/lib/api";
import { AUDIT_ACTIONS, MANAGER_ROLES } from "@/lib/constants";
import { audit } from "./audit";
import { notify } from "./notifications";
import type { SessionUser } from "@/server/auth/types";

export async function listMembers(clubId: string, q?: string, status?: string) {
  const where: any = { clubId };
  if (status && status !== "ALL") {
    where.status = status;
  } else {
    where.status = { not: "REMOVED" };
  }
  if (q) {
    where.user = { OR: [{ name: { contains: q } }, { email: { contains: q } }] };
  }
  const members = await prisma.clubMember.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true, mobile: true, photoUrl: true, skillLevel: true } }
    },
    orderBy: [{ status: "asc" }, { joinedAt: "asc" }]
  });
  const [ratings, wallets] = await Promise.all([
    prisma.playerRating.findMany({ where: { clubId } }),
    prisma.wallet.findMany({ where: { clubId } })
  ]);
  const ratingMap = new Map(ratings.map((r) => [r.userId, r]));
  const walletMap = new Map(wallets.map((w) => [w.userId, w]));
  return members.map((m) => ({
    id: m.id,
    userId: m.userId,
    name: m.user.name,
    email: m.user.email,
    mobile: m.user.mobile,
    photoUrl: m.user.photoUrl,
    skillLevel: m.user.skillLevel,
    role: m.role,
    status: m.status,
    joinedAt: m.joinedAt,
    user: m.user,
    rating: ratingMap.get(m.userId)?.rating ?? 1000,
    balance: walletMap.get(m.userId)?.balance ?? 0,
    walletBalance: walletMap.get(m.userId)?.balance ?? 0,
    attendanceRate: 100
  }));
}

export async function requestJoin(clubId: string, user: SessionUser) {
  const club = await prisma.club.findFirst({ where: { id: clubId, deletedAt: null, isPublic: true } });
  if (!club) throw ApiError.notFound("Club not found or not accepting requests");
  const existing = await prisma.clubMember.findUnique({ where: { clubId_userId: { clubId, userId: user.id } } });
  if (existing && existing.status === "ACTIVE") throw ApiError.conflict("Already a member");
  if (existing && existing.status === "PENDING") throw ApiError.conflict("Request already pending");
  if (existing && (existing.status === "BLOCKED" || existing.status === "REMOVED")) {
    throw ApiError.forbidden("Your membership was revoked by club admins");
  }
  const member = await prisma.clubMember.create({
    data: { clubId, userId: user.id, role: "PLAYER", status: "PENDING" }
  });
  await audit({
    clubId,
    actorUserId: user.id,
    action: AUDIT_ACTIONS.MEMBER_JOINED,
    entityType: "ClubMember",
    entityId: member.id
  });
  const managers = await prisma.clubMember.findMany({
    where: { clubId, status: "ACTIVE", role: { in: MANAGER_ROLES } }
  });
  await notifyManySafe(
    managers.map((m) => ({
      userId: m.userId,
      clubId,
      type: "MEMBERSHIP_APPROVED",
      title: `${user.name} requested to join`,
      body: `Approve or reject the request in Members.`,
      data: { memberId: member.id }
    }))
  );
  return member;
}

async function notifyManySafe(inputs: Parameters<typeof notify>[0][]) {
  for (const input of inputs) await notify(input);
}

export async function addMember(clubId: string, actor: SessionUser, input: { email: string; name?: string; role?: string }) {
  const email = input.email.toLowerCase().trim();
  let target = await prisma.user.findUnique({ where: { email } });
  if (!target) {
    target = await prisma.user.create({
      data: { email, name: input.name?.trim() || email.split("@")[0] }
    });
  }
  const existing = await prisma.clubMember.findUnique({ where: { clubId_userId: { clubId, userId: target.id } } });
  if (existing && existing.status === "ACTIVE") throw ApiError.conflict("User is already an active member");
  if (existing && existing.status !== "REMOVED") {
    const updated = await prisma.clubMember.update({
      where: { id: existing.id },
      data: { status: "ACTIVE", removedAt: null, role: input.role ?? existing.role }
    });
    await audit({
      clubId,
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.MEMBER_APPROVED,
      entityType: "ClubMember",
      entityId: updated.id,
      newValue: { status: "ACTIVE" }
    });
    return updated;
  }
  const member = await prisma.clubMember.upsert({
    where: { clubId_userId: { clubId, userId: target.id } },
    create: { clubId, userId: target.id, role: input.role ?? "PLAYER", status: "ACTIVE" },
    update: { status: "ACTIVE", removedAt: null, role: input.role ?? "PLAYER" }
  });
  await audit({
    clubId,
    actorUserId: actor.id,
    action: AUDIT_ACTIONS.MEMBER_ADDED,
    entityType: "ClubMember",
    entityId: member.id,
    newValue: { email: target.email, role: member.role }
  });
  await notify({
    userId: target.id,
    clubId,
    type: "MEMBERSHIP_APPROVED",
    title: "You were added to a club",
    body: `A club admin added you as ${member.role.toLowerCase()}.`
  });
  return member;
}

export async function approveMembership(clubId: string, actor: SessionUser, memberId: string, approve: boolean) {
  const member = await prisma.clubMember.findFirst({ where: { id: memberId, clubId } });
  if (!member) throw ApiError.notFound("Membership request not found");
  if (member.status !== "PENDING") throw ApiError.conflict(`Request is already ${member.status.toLowerCase()}`);
  const updated = await prisma.clubMember.update({
    where: { id: memberId },
    data: approve ? { status: "ACTIVE" } : { status: "REMOVED", removedAt: new Date() }
  });
  await audit({
    clubId,
    actorUserId: actor.id,
    action: approve ? AUDIT_ACTIONS.MEMBER_APPROVED : AUDIT_ACTIONS.MEMBER_BLOCKED,
    entityType: "ClubMember",
    entityId: memberId,
    previousValue: { status: "PENDING" },
    newValue: { status: updated.status }
  });
  if (approve) {
    await notify({
      userId: member.userId,
      clubId,
      type: "MEMBERSHIP_APPROVED",
      title: "Membership approved",
      body: "Welcome to the club! Your membership is now active."
    });
  }
  return updated;
}

export async function changeRole(clubId: string, actor: SessionUser, memberId: string, role: string) {
  if (!["OWNER", "ADMIN", "COACH", "PLAYER"].includes(role)) throw ApiError.badRequest("Invalid role");
  const member = await prisma.clubMember.findFirst({ where: { id: memberId, clubId } });
  if (!member || member.status !== "ACTIVE") throw ApiError.notFound("Active member not found");
  if (member.role === "OWNER" && role !== "OWNER") {
    const owners = await prisma.clubMember.count({ where: { clubId, role: "OWNER", status: "ACTIVE" } });
    if (owners <= 1) throw ApiError.conflict("Cannot demote the only owner. Promote another admin first.");
  }
  if ((role === "OWNER" || role === "ADMIN") && actor.role !== "SUPER_ADMIN") {
    const actorMembership = await prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId: actor.id } }
    });
    if (!actorMembership || actorMembership.role !== "OWNER") {
      throw ApiError.forbidden("Only the club owner can assign OWNER/ADMIN roles");
    }
  }
  const updated = await prisma.clubMember.update({ where: { id: memberId }, data: { role } });
  await audit({
    clubId,
    actorUserId: actor.id,
    action: AUDIT_ACTIONS.ROLE_CHANGED,
    entityType: "ClubMember",
    entityId: memberId,
    previousValue: { role: member.role },
    newValue: { role }
  });
  await notify({
    userId: member.userId,
    clubId,
    type: "MEMBERSHIP_ROLE",
    title: "Your club role changed",
    body: `You are now ${role.toLowerCase()} of the club.`
  });
  return updated;
}

export async function removeMember(clubId: string, actor: SessionUser, memberId: string) {
  const member = await prisma.clubMember.findFirst({ where: { id: memberId, clubId } });
  if (!member) throw ApiError.notFound("Member not found");
  if (member.role === "OWNER") {
    const owners = await prisma.clubMember.count({ where: { clubId, role: "OWNER", status: "ACTIVE" } });
    if (owners <= 1) throw ApiError.conflict("Cannot remove the only owner");
  }
  const updated = await prisma.clubMember.update({
    where: { id: memberId },
    data: { status: "REMOVED", removedAt: new Date(), role: member.role === "OWNER" ? "PLAYER" : member.role }
  });
  await audit({
    clubId,
    actorUserId: actor.id,
    action: AUDIT_ACTIONS.MEMBER_REMOVED,
    entityType: "ClubMember",
    entityId: memberId,
    previousValue: { status: member.status, role: member.role },
    newValue: { status: "REMOVED" }
  });
  return updated;
}

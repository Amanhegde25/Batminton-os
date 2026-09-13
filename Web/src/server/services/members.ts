import { clubs, clubMembers, users, playerRatings, wallets } from "@/server/db";
import { ApiError } from "@/lib/api";
import { AUDIT_ACTIONS, MANAGER_ROLES } from "@/lib/constants";
import { audit } from "./audit";
import { notify } from "./notifications";
import type { SessionUser } from "@/server/auth/types";
import { cuid } from "@/lib/id";

export async function listMembers(clubId: string, q?: string, status?: string) {
  const filter: Record<string, unknown> = { clubId };
  if (status && status !== "ALL") {
    filter.status = status;
  } else {
    filter.status = { $ne: "REMOVED" };
  }

  let userFilter: Record<string, unknown> | null = null;
  if (q) {
    const matchingUsers = await users().find(
      { $or: [{ name: { $regex: q, $options: "i" } }, { email: { $regex: q, $options: "i" } }] },
      { projection: { id: 1 } }
    ).toArray();
    filter.userId = { $in: matchingUsers.map((u) => u.id) };
  }

  const members = await clubMembers().find(filter).sort({ status: 1, joinedAt: 1 }).toArray();
  const memberUserIds = members.map((m) => m.userId as string);

  const [memberUsers, ratings, walletsData] = await Promise.all([
    users().find({ id: { $in: memberUserIds } }, {
      projection: { id: 1, name: 1, email: 1, mobile: 1, photoUrl: 1, skillLevel: 1, _id: 0 }
    }).toArray(),
    playerRatings().find({ clubId }).toArray(),
    wallets().find({ clubId }).toArray()
  ]);

  const userMap = new Map(memberUsers.map((u) => [u.id, u]));
  const ratingMap = new Map(ratings.map((r) => [r.userId, r]));
  const walletMap = new Map(walletsData.map((w) => [w.userId, w]));

  return members.map((m) => {
    const u = userMap.get(m.userId as string) ?? { id: m.userId, name: "Unknown", email: "", mobile: null, photoUrl: null, skillLevel: null };
    return {
      id: m.id,
      userId: m.userId,
      name: u.name,
      email: u.email,
      mobile: u.mobile,
      photoUrl: u.photoUrl,
      skillLevel: u.skillLevel,
      role: m.role,
      status: m.status,
      joinedAt: m.joinedAt,
      user: u,
      rating: (ratingMap.get(m.userId as string)?.rating as number) ?? 1000,
      balance: (walletMap.get(m.userId as string)?.balance as number) ?? 0,
      walletBalance: (walletMap.get(m.userId as string)?.balance as number) ?? 0,
      attendanceRate: 100
    };
  });
}

export async function requestJoin(clubId: string, user: SessionUser) {
  const club = await clubs().findOne({ id: clubId, deletedAt: null, isPublic: true });
  if (!club) throw ApiError.notFound("Club not found or not accepting requests");
  const existing = await clubMembers().findOne({ clubId, userId: user.id });
  if (existing && existing.status === "ACTIVE") throw ApiError.conflict("Already a member");
  if (existing && existing.status === "PENDING") throw ApiError.conflict("Request already pending");
  if (existing && (existing.status === "BLOCKED" || existing.status === "REMOVED")) {
    throw ApiError.forbidden("Your membership was revoked by club admins");
  }
  const member = {
    id: cuid(),
    clubId,
    userId: user.id,
    role: "PLAYER",
    status: "PENDING",
    joinedAt: new Date(),
    removedAt: null
  };
  await clubMembers().insertOne(member);
  await audit({
    clubId,
    actorUserId: user.id,
    action: AUDIT_ACTIONS.MEMBER_JOINED,
    entityType: "ClubMember",
    entityId: member.id
  });
  const managers = await clubMembers().find({ clubId, status: "ACTIVE", role: { $in: MANAGER_ROLES } }).toArray();
  for (const m of managers) {
    await notify({
      userId: m.userId as string,
      clubId,
      type: "MEMBERSHIP_APPROVED",
      title: `${user.name} requested to join`,
      body: `Approve or reject the request in Members.`,
      data: { memberId: member.id }
    });
  }
  return member;
}

export async function addMember(clubId: string, actor: SessionUser, input: { email: string; name?: string; role?: string }) {
  const email = input.email.toLowerCase().trim();
  let target = (await users().findOne({ email })) as any;
  if (!target) {
    const now = new Date();
    const newUser = {
      id: cuid(),
      email,
      name: input.name?.trim() || email.split("@")[0],
      mobile: null,
      passwordHash: null,
      photoUrl: null,
      dob: null,
      gender: null,
      role: "PLAYER",
      skillLevel: null,
      playingStyle: null,
      dominantHand: null,
      preferredTime: null,
      googleId: null,
      tokenVersion: 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    };
    await users().insertOne(newUser);
    target = newUser;
  }
  const targetId = target.id as string;
  const existing = await clubMembers().findOne({ clubId, userId: targetId });
  if (existing && existing.status === "ACTIVE") throw ApiError.conflict("User is already an active member");
  if (existing && existing.status !== "REMOVED") {
    const updated = await clubMembers().findOneAndUpdate(
      { id: existing.id },
      { $set: { status: "ACTIVE", removedAt: null, role: input.role ?? existing.role } },
      { returnDocument: "after" }
    );
    await audit({
      clubId,
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.MEMBER_APPROVED,
      entityType: "ClubMember",
      entityId: existing.id as string,
      newValue: { status: "ACTIVE" }
    });
    return updated;
  }
  // Upsert
  const memberId = existing?.id ?? cuid();
  const role = input.role ?? "PLAYER";
  const result = await clubMembers().findOneAndUpdate(
    { clubId, userId: targetId },
    {
      $set: { status: "ACTIVE", removedAt: null, role },
      $setOnInsert: { id: memberId, clubId, userId: targetId, joinedAt: new Date() }
    },
    { upsert: true, returnDocument: "after" }
  );
  await audit({
    clubId,
    actorUserId: actor.id,
    action: AUDIT_ACTIONS.MEMBER_ADDED,
    entityType: "ClubMember",
    entityId: (result?.id ?? memberId) as string,
    newValue: { email: target.email, role }
  });
  await notify({
    userId: targetId,
    clubId,
    type: "MEMBERSHIP_APPROVED",
    title: "You were added to a club",
    body: `A club admin added you as ${role.toLowerCase()}.`
  });
  return result;
}

export async function approveMembership(clubId: string, actor: SessionUser, memberId: string, approve: boolean) {
  const member = await clubMembers().findOne({ id: memberId, clubId });
  if (!member) throw ApiError.notFound("Membership request not found");
  if (member.status !== "PENDING") throw ApiError.conflict(`Request is already ${(member.status as string).toLowerCase()}`);
  const updated = await clubMembers().findOneAndUpdate(
    { id: memberId },
    { $set: approve ? { status: "ACTIVE" } : { status: "REMOVED", removedAt: new Date() } },
    { returnDocument: "after" }
  );
  await audit({
    clubId,
    actorUserId: actor.id,
    action: approve ? AUDIT_ACTIONS.MEMBER_APPROVED : AUDIT_ACTIONS.MEMBER_BLOCKED,
    entityType: "ClubMember",
    entityId: memberId,
    previousValue: { status: "PENDING" },
    newValue: { status: updated?.status }
  });
  if (approve) {
    await notify({
      userId: member.userId as string,
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
  const member = await clubMembers().findOne({ id: memberId, clubId });
  if (!member || member.status !== "ACTIVE") throw ApiError.notFound("Active member not found");
  if (member.role === "OWNER" && role !== "OWNER") {
    const owners = await clubMembers().countDocuments({ clubId, role: "OWNER", status: "ACTIVE" });
    if (owners <= 1) throw ApiError.conflict("Cannot demote the only owner. Promote another admin first.");
  }
  if ((role === "OWNER" || role === "ADMIN") && actor.role !== "SUPER_ADMIN") {
    const actorMembership = await clubMembers().findOne({ clubId, userId: actor.id });
    if (!actorMembership || actorMembership.role !== "OWNER") {
      throw ApiError.forbidden("Only the club owner can assign OWNER/ADMIN roles");
    }
  }
  const updated = await clubMembers().findOneAndUpdate(
    { id: memberId },
    { $set: { role } },
    { returnDocument: "after" }
  );
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
    userId: member.userId as string,
    clubId,
    type: "MEMBERSHIP_ROLE",
    title: "Your club role changed",
    body: `You are now ${role.toLowerCase()} of the club.`
  });
  return updated;
}

export async function removeMember(clubId: string, actor: SessionUser, memberId: string) {
  const member = await clubMembers().findOne({ id: memberId, clubId });
  if (!member) throw ApiError.notFound("Member not found");
  if (member.role === "OWNER") {
    const owners = await clubMembers().countDocuments({ clubId, role: "OWNER", status: "ACTIVE" });
    if (owners <= 1) throw ApiError.conflict("Cannot remove the only owner");
  }
  const updated = await clubMembers().findOneAndUpdate(
    { id: memberId },
    { $set: { status: "REMOVED", removedAt: new Date(), role: member.role === "OWNER" ? "PLAYER" : member.role } },
    { returnDocument: "after" }
  );
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

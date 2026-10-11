import { clubs, users, matches, attendanceRecords, clubMembers, courts, walletTransactions, playGroups, playGroupMembers, auditLogs } from "@/server/db";
import { ApiError } from "@/lib/api";
import { AUDIT_ACTIONS } from "@/lib/constants";
import { audit } from "./audit";

// ── Platform Overview (extended) ──

export async function platformOverview() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [clubDocs, totalUsers, totalMatches, attendanceToday] = await Promise.all([
    clubs().find({ deletedAt: null }).sort({ createdAt: -1 }).toArray(),
    users().countDocuments({ deletedAt: null }),
    matches().countDocuments({}),
    attendanceRecords().countDocuments({ day: now.toISOString().slice(0, 10) })
  ]);

  const ownerIds = Array.from(new Set(clubDocs.map((c) => c.ownerId as string).filter(Boolean)));
  const clubIds = clubDocs.map((c) => c.id as string);

  const [ownerUsers, memberCounts, matchCounts, courtCounts] = await Promise.all([
    users().find({ id: { $in: ownerIds } }, { projection: { id: 1, name: 1, email: 1 } }).toArray(),
    clubMembers().aggregate([
      { $match: { clubId: { $in: clubIds } } },
      { $group: { _id: "$clubId", count: { $sum: 1 } } }
    ]).toArray(),
    matches().aggregate([
      { $match: { clubId: { $in: clubIds } } },
      { $group: { _id: "$clubId", count: { $sum: 1 } } }
    ]).toArray(),
    courts().aggregate([
      { $match: { clubId: { $in: clubIds }, deletedAt: null } },
      { $group: { _id: "$clubId", count: { $sum: 1 } } }
    ]).toArray()
  ]);

  // 7-day and 30-day trends
  const [userTrend, matchTrend, totalGroups] = await Promise.all([
    users().aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo }, deletedAt: null } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 as const } }
    ]).toArray(),
    matches().aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 as const } }
    ]).toArray(),
    playGroups().countDocuments({ deletedAt: null })
  ]);

  const recentUsers7d = await users().countDocuments({ createdAt: { $gte: sevenDaysAgo }, deletedAt: null });
  const recentUsers30d = await users().countDocuments({ createdAt: { $gte: thirtyDaysAgo }, deletedAt: null });

  const ownerMap = new Map(ownerUsers.map((u) => [u.id as string, { name: u.name, email: u.email }]));
  const memberMap = new Map(memberCounts.map((m) => [m._id as string, m.count as number]));
  const matchMap = new Map(matchCounts.map((m) => [m._id as string, m.count as number]));
  const courtMap = new Map(courtCounts.map((c) => [c._id as string, c.count as number]));

  const planCounts: Record<string, number> = { FREE: 0 };
  for (const c of clubDocs) {
    const plan = (c.subscriptionPlan as string) || "FREE";
    planCounts[plan] = (planCounts[plan] || 0) + 1;
  }

  return {
    totals: { clubs: clubDocs.length, users: totalUsers, matches: totalMatches, attendanceToday, groups: totalGroups },
    growth: {
      users7d: recentUsers7d,
      users30d: recentUsers30d,
      userTrend: userTrend.map((r) => ({ date: r._id as string, count: r.count as number })),
      matchTrend: matchTrend.map((r) => ({ date: r._id as string, count: r.count as number }))
    },
    planCounts,
    clubs: clubDocs.map((c) => {
      const cid = c.id as string;
      return {
        id: cid,
        name: c.name,
        slug: c.slug,
        city: c.city,
        plan: c.subscriptionPlan,
        owner: ownerMap.get(c.ownerId as string) || null,
        members: memberMap.get(cid) || 0,
        matches: matchMap.get(cid) || 0,
        courts: courtMap.get(cid) || 0,
        createdAt: c.createdAt
      };
    })
  };
}

// ── User Management ──

export async function listPlatformUsers(page = 1, search?: string, roleFilter?: string) {
  const pageSize = 50;
  const skip = (page - 1) * pageSize;
  const filter: Record<string, any> = { deletedAt: null };

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { mobile: { $regex: search, $options: "i" } }
    ];
  }
  if (roleFilter) filter.role = roleFilter;

  const [items, total] = await Promise.all([
    users().find(filter, {
      projection: { passwordHash: 0, salt: 0, _id: 0 }
    }).sort({ createdAt: -1 }).skip(skip).limit(pageSize).toArray(),
    users().countDocuments(filter)
  ]);

  // Attach club membership count per user
  const userIds = items.map((u) => u.id as string);
  const membershipCounts = userIds.length > 0
    ? await clubMembers().aggregate([
      { $match: { userId: { $in: userIds }, status: "ACTIVE" } },
      { $group: { _id: "$userId", count: { $sum: 1 } } }
    ]).toArray()
    : [];
  const mcMap = new Map(membershipCounts.map((m) => [m._id as string, m.count as number]));

  return {
    items: items.map((u) => ({
      ...u,
      clubCount: mcMap.get(u.id as string) || 0
    })),
    total,
    page,
    pageSize
  };
}

export async function updateUserRole(userId: string, newRole: string, actorId: string) {
  const user = await users().findOne({ id: userId, deletedAt: null });
  if (!user) throw ApiError.notFound("User not found");
  const previousRole = user.role as string;
  if (previousRole === newRole) return user;

  await users().updateOne({ id: userId }, { $set: { role: newRole, updatedAt: new Date() } });
  await audit({
    actorUserId: actorId,
    action: AUDIT_ACTIONS.USER_ROLE_CHANGED,
    entityType: "User",
    entityId: userId,
    previousValue: { role: previousRole },
    newValue: { role: newRole }
  });
  return { ...user, role: newRole };
}

export async function suspendUser(userId: string, actorId: string) {
  const user = await users().findOne({ id: userId, deletedAt: null });
  if (!user) throw ApiError.notFound("User not found");
  if (user.role === "SUPER_ADMIN") throw ApiError.forbidden("Cannot suspend a super admin");

  const suspended = !(user.suspended as boolean);
  await users().updateOne({ id: userId }, { $set: { suspended, updatedAt: new Date() } });
  await audit({
    actorUserId: actorId,
    action: AUDIT_ACTIONS.USER_SUSPENDED,
    entityType: "User",
    entityId: userId,
    newValue: { suspended }
  });
  return { ...user, suspended };
}

export async function deleteUser(userId: string, actorId: string) {
  const user = await users().findOne({ id: userId, deletedAt: null });
  if (!user) throw ApiError.notFound("User not found");
  if (user.role === "SUPER_ADMIN") throw ApiError.forbidden("Cannot delete a super admin");

  await users().updateOne({ id: userId }, { $set: { deletedAt: new Date() } });
  await audit({
    actorUserId: actorId,
    action: AUDIT_ACTIONS.USER_DELETED,
    entityType: "User",
    entityId: userId
  });
}

// ── Club Management ──

export async function changeClubPlan(clubId: string, newPlan: string, actorId: string) {
  const club = await clubs().findOne({ id: clubId, deletedAt: null });
  if (!club) throw ApiError.notFound("Club not found");
  const previousPlan = club.subscriptionPlan as string;

  await clubs().updateOne({ id: clubId }, { $set: { subscriptionPlan: newPlan, updatedAt: new Date() } });
  await audit({
    clubId,
    actorUserId: actorId,
    action: AUDIT_ACTIONS.PLAN_CHANGED,
    entityType: "Club",
    entityId: clubId,
    previousValue: { plan: previousPlan },
    newValue: { plan: newPlan }
  });
  return { ...club, subscriptionPlan: newPlan };
}

export async function deleteClub(clubId: string, actorId: string) {
  const club = await clubs().findOne({ id: clubId, deletedAt: null });
  if (!club) throw ApiError.notFound("Club not found");

  await clubs().updateOne({ id: clubId }, { $set: { deletedAt: new Date() } });
  await audit({
    clubId,
    actorUserId: actorId,
    action: AUDIT_ACTIONS.CLUB_DELETED,
    entityType: "Club",
    entityId: clubId
  });
}

// ── Group Management ──

export async function listPlatformGroups(page = 1, search?: string) {
  const pageSize = 50;
  const skip = (page - 1) * pageSize;
  const filter: Record<string, any> = { deletedAt: null };
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { city: { $regex: search, $options: "i" } }
    ];
  }

  const [items, total] = await Promise.all([
    playGroups().find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageSize).toArray(),
    playGroups().countDocuments(filter)
  ]);

  const groupIds = items.map((g) => g.id as string);
  const memberCounts = groupIds.length > 0
    ? await playGroupMembers().aggregate([
      { $match: { groupId: { $in: groupIds } } },
      { $group: { _id: "$groupId", count: { $sum: 1 } } }
    ]).toArray()
    : [];
  const mcMap = new Map(memberCounts.map((m) => [m._id as string, m.count as number]));

  const creatorIds = Array.from(new Set(items.map((g) => g.createdById as string).filter(Boolean)));
  const creators = creatorIds.length > 0
    ? await users().find({ id: { $in: creatorIds } }, { projection: { id: 1, name: 1, email: 1 } }).toArray()
    : [];
  const creatorMap = new Map(creators.map((u) => [u.id as string, { name: u.name, email: u.email }]));

  return {
    items: items.map((g) => ({
      id: g.id,
      name: g.name,
      slug: g.slug,
      city: g.city,
      skillLevel: g.skillLevel,
      isPublic: g.isPublic,
      members: mcMap.get(g.id as string) || 0,
      creator: creatorMap.get(g.createdById as string) || null,
      createdAt: g.createdAt
    })),
    total,
    page,
    pageSize
  };
}

export async function deletePlatformGroup(groupId: string, actorId: string) {
  const group = await playGroups().findOne({ id: groupId, deletedAt: null });
  if (!group) throw ApiError.notFound("Group not found");

  await playGroups().updateOne({ id: groupId }, { $set: { deletedAt: new Date() } });
  await audit({
    actorUserId: actorId,
    action: AUDIT_ACTIONS.GROUP_DELETED_PLATFORM,
    entityType: "PlayGroup",
    entityId: groupId
  });
}

// ── Platform Audit Log ──

export async function platformAuditLog(page = 1, pageSize = 50) {
  const skip = (page - 1) * pageSize;
  const pipeline = [
    { $sort: { createdAt: -1 as const } },
    { $skip: skip },
    { $limit: pageSize },
    {
      $lookup: {
        from: "users",
        let: { actorId: "$actorUserId" },
        pipeline: [
          { $match: { $expr: { $eq: ["$id", "$$actorId"] } } },
          { $project: { name: 1, email: 1, _id: 0 } }
        ],
        as: "actorArr"
      }
    },
    { $addFields: { actor: { $arrayElemAt: ["$actorArr", 0] } } },
    { $project: { actorArr: 0, _id: 0 } }
  ];
  const [items, total] = await Promise.all([
    auditLogs().aggregate(pipeline).toArray(),
    auditLogs().countDocuments({})
  ]);
  return { items, total, page, pageSize };
}

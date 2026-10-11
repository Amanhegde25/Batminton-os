import {
  clubs,
  clubMembers,
  users,
  walletTransactions,
  wallets,
  penalties,
  attendanceRecords,
  matches,
  courts,
  auditLogs
} from "@/server/db";
import { ApiError } from "@/lib/api";
import { AUDIT_ACTIONS } from "@/lib/constants";
import { audit } from "./audit";
import { notifyMany } from "./notifications";

// ── Club Admin Overview ──

export async function clubAdminOverview(clubId: string) {
  const club = await clubs().findOne({ id: clubId, deletedAt: null });
  if (!club) throw ApiError.notFound("Club not found");

  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    activeMembers,
    pendingMembers,
    blockedMembers,
    totalMatches,
    totalCourts,
    attendanceToday,
    recentAudit
  ] = await Promise.all([
    clubMembers().countDocuments({ clubId, status: "ACTIVE" }),
    clubMembers().countDocuments({ clubId, status: "PENDING" }),
    clubMembers().countDocuments({ clubId, status: "BLOCKED" }),
    matches().countDocuments({ clubId }),
    courts().countDocuments({ clubId, deletedAt: null }),
    attendanceRecords().countDocuments({ clubId, day: todayKey }),
    auditLogs().find({ clubId }).sort({ createdAt: -1 }).limit(10).toArray()
  ]);

  // Aggregate total wallet balance across club members
  const memberDocs = await clubMembers().find({ clubId, status: "ACTIVE" }, { projection: { userId: 1 } }).toArray();
  const userIds = memberDocs.map((m) => m.userId as string);

  const walletAgg = userIds.length > 0
    ? await wallets().aggregate([
      { $match: { clubId, userId: { $in: userIds } } },
      { $group: { _id: null, totalBalance: { $sum: "$balance" }, totalCredited: { $sum: "$totalCredited" }, totalDebited: { $sum: "$totalDebited" } } }
    ]).toArray()
    : [];

  const walletSummary = walletAgg[0] || { totalBalance: 0, totalCredited: 0, totalDebited: 0 };

  // 30-day membership growth trend
  const memberTrend = await clubMembers().aggregate([
    { $match: { clubId, joinedAt: { $gte: thirtyDaysAgo } } },
    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$joinedAt" } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 as const } }
  ]).toArray();

  // 30-day attendance trend
  const attendanceTrend = await attendanceRecords().aggregate([
    { $match: { clubId, createdAt: { $gte: thirtyDaysAgo } } },
    { $group: { _id: "$day", count: { $sum: 1 } } },
    { $sort: { _id: 1 as const } }
  ]).toArray();

  return {
    club: {
      id: club.id,
      name: club.name,
      slug: club.slug,
      plan: club.subscriptionPlan || "FREE"
    },
    members: {
      active: activeMembers,
      pending: pendingMembers,
      blocked: blockedMembers,
      trend: memberTrend.map((r) => ({ date: r._id as string, count: r.count as number }))
    },
    activity: {
      matches: totalMatches,
      courts: totalCourts,
      attendanceToday,
      attendanceTrend: attendanceTrend.map((r) => ({ date: r._id as string, count: r.count as number }))
    },
    finances: {
      totalBalance: walletSummary.totalBalance || 0,
      totalCredited: walletSummary.totalCredited || 0,
      totalDebited: walletSummary.totalDebited || 0
    },
    recentAudit: recentAudit.map((a) => ({
      id: a.id,
      action: a.action,
      actorUserId: a.actorUserId,
      entityType: a.entityType,
      createdAt: a.createdAt
    }))
  };
}

// ── Club Revenue Breakdown ──

export async function clubRevenueBreakdown(clubId: string, days = 30) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [typeBreakdown, dailyVolume, outstandingPenalties] = await Promise.all([
    walletTransactions().aggregate([
      { $match: { clubId, createdAt: { $gte: cutoff } } },
      { $group: { _id: "$type", totalAmount: { $sum: "$amount" }, count: { $sum: 1 } } }
    ]).toArray(),
    walletTransactions().aggregate([
      { $match: { clubId, createdAt: { $gte: cutoff } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, totalAmount: { $sum: "$amount" }, count: { $sum: 1 } } },
      { $sort: { _id: 1 as const } }
    ]).toArray(),
    penalties().aggregate([
      { $match: { clubId, status: "ISSUED" } },
      { $group: { _id: null, totalDues: { $sum: "$amount" }, count: { $sum: 1 } } }
    ]).toArray()
  ]);

  return {
    days,
    byType: typeBreakdown.map((t) => ({ type: t._id as string, total: t.totalAmount as number, count: t.count as number })),
    daily: dailyVolume.map((d) => ({ date: d._id as string, total: d.totalAmount as number, count: d.count as number })),
    unpaidPenalties: outstandingPenalties[0] || { totalDues: 0, count: 0 }
  };
}

// ── Broadcast Announcement ──

export async function broadcastAnnouncement(
  clubId: string,
  actorId: string,
  input: { title: string; body: string }
) {
  const club = await clubs().findOne({ id: clubId, deletedAt: null });
  if (!club) throw ApiError.notFound("Club not found");

  const members = await clubMembers().find(
    { clubId, status: "ACTIVE" },
    { projection: { userId: 1 } }
  ).toArray();

  const notifications = members.map((m) => ({
    userId: m.userId as string,
    clubId,
    type: "ANNOUNCEMENT",
    title: input.title,
    body: input.body
  }));

  if (notifications.length > 0) {
    await notifyMany(notifications);
  }

  await audit({
    clubId,
    actorUserId: actorId,
    action: AUDIT_ACTIONS.ANNOUNCEMENT_SENT,
    entityType: "ClubAnnouncement",
    entityId: clubId,
    newValue: { title: input.title, recipientCount: notifications.length }
  });

  return { delivered: notifications.length };
}

// ── Attendance Report ──

export async function attendanceReport(
  clubId: string,
  filter: { startDate?: string; endDate?: string; userId?: string }
) {
  const query: Record<string, any> = { clubId };
  if (filter.startDate || filter.endDate) {
    query.day = {};
    if (filter.startDate) query.day.$gte = filter.startDate;
    if (filter.endDate) query.day.$lte = filter.endDate;
  }
  if (filter.userId) query.userId = filter.userId;

  const records = await attendanceRecords()
    .find(query)
    .sort({ day: -1, createdAt: -1 })
    .limit(1000)
    .toArray();

  const userIds = Array.from(new Set(records.map((r) => r.userId as string)));
  const userDocs = userIds.length > 0
    ? await users().find({ id: { $in: userIds } }, { projection: { id: 1, name: 1, email: 1 } }).toArray()
    : [];
  const userMap = new Map(userDocs.map((u) => [u.id as string, u]));

  return records.map((r) => ({
    id: r.id,
    day: r.day,
    userId: r.userId,
    userName: userMap.get(r.userId as string)?.name || "Unknown",
    userEmail: userMap.get(r.userId as string)?.email || null,
    status: r.status,
    method: r.method,
    createdAt: r.createdAt
  }));
}

// ── Financial Report ──

export async function financialReport(
  clubId: string,
  filter: { startDate?: string; endDate?: string }
) {
  const query: Record<string, any> = { clubId };
  if (filter.startDate || filter.endDate) {
    query.createdAt = {};
    if (filter.startDate) query.createdAt.$gte = new Date(filter.startDate);
    if (filter.endDate) query.createdAt.$lte = new Date(filter.endDate);
  }

  const txns = await walletTransactions()
    .find(query)
    .sort({ createdAt: -1 })
    .limit(1000)
    .toArray();

  const userIds = Array.from(new Set(txns.map((t) => t.userId as string)));
  const userDocs = userIds.length > 0
    ? await users().find({ id: { $in: userIds } }, { projection: { id: 1, name: 1, email: 1 } }).toArray()
    : [];
  const userMap = new Map(userDocs.map((u) => [u.id as string, u]));

  return txns.map((t) => ({
    id: t.id,
    userId: t.userId,
    userName: userMap.get(t.userId as string)?.name || "Unknown",
    userEmail: userMap.get(t.userId as string)?.email || null,
    amount: t.amount,
    type: t.type,
    description: t.description || null,
    balanceAfter: t.balanceAfter,
    createdAt: t.createdAt
  }));
}

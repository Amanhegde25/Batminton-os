import { clubs, users, matches, attendanceRecords, clubMembers, courts } from "@/server/db";

export async function platformOverview() {
  const [clubDocs, totalUsers, totalMatches, attendanceToday] = await Promise.all([
    clubs().find({ deletedAt: null }).sort({ createdAt: -1 }).toArray(),
    users().countDocuments({ deletedAt: null }),
    matches().countDocuments({}),
    attendanceRecords().countDocuments({ day: new Date().toISOString().slice(0, 10) })
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
    totals: { clubs: clubDocs.length, users: totalUsers, matches: totalMatches, attendanceToday },
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


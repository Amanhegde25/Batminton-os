import { prisma } from "@/server/db";

export async function platformOverview() {
  const [clubs, users, matches, attendanceToday] = await Promise.all([
    prisma.club.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        owner: { select: { name: true, email: true } },
        _count: { select: { members: true, matches: true, courts: true } }
      }
    }),
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.match.count(),
    prisma.attendanceRecord.count({ where: { day: new Date().toISOString().slice(0, 10) } })
  ]);
  const planCounts = { FREE: 0 };
  for (const c of clubs) {
    if (c.subscriptionPlan in planCounts) planCounts[c.subscriptionPlan as keyof typeof planCounts]++;
  }
  return {
    totals: { clubs: clubs.length, users, matches, attendanceToday },
    planCounts,
    clubs: clubs.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      city: c.city,
      plan: c.subscriptionPlan,
      owner: c.owner,
      members: c._count.members,
      matches: c._count.matches,
      courts: c._count.courts,
      createdAt: c.createdAt
    }))
  };
}

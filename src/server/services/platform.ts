import { prisma } from "@/server/db";
import { ApiError } from "@/lib/api";
import { PLANS } from "@/lib/constants";
import { audit } from "./audit";
import { notify } from "./notifications";

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
  const planCounts = { FREE: 0, PRO: 0, PREMIUM: 0 };
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

export async function changePlan(clubId: string, plan: string, actorId: string) {
  if (!PLANS.includes(plan as any)) throw ApiError.badRequest(`Plan must be one of ${PLANS.join(", ")}`);
  const club = await prisma.club.findFirst({ where: { id: clubId, deletedAt: null } });
  if (!club) throw ApiError.notFound("Club not found");
  const updated = await prisma.club.update({ where: { id: clubId }, data: { subscriptionPlan: plan } });
  await audit({
    clubId,
    actorUserId: actorId,
    action: "platform.plan_changed",
    entityType: "Club",
    entityId: clubId,
    previousValue: { plan: club.subscriptionPlan },
    newValue: { plan }
  });
  await notify({
    userId: club.ownerId,
    clubId,
    type: "PLAN_CHANGED",
    title: `Subscription changed to ${plan}`,
    body: `${club.name} is now on the ${plan} plan.`
  });
  return updated;
}

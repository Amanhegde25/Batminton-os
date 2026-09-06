import { ApiError } from "@/lib/api";
import type { SessionUser } from "./auth/types";
import { MANAGER_ROLES, STAFF_ROLES, planAllows, PLAN_LIMITS, type Plan, type Feature } from "@/lib/constants";
import { prisma } from "@/server/db";

export interface ClubContext {
  clubId: string;
  club: { id: string; name: string; subscriptionPlan: string; settings: string; ownerId: string };
  membership: { id: string; role: string; status: string; userId: string } | null;
  user: SessionUser;
}

export async function requireUser(user: SessionUser | null): Promise<SessionUser> {
  if (!user) throw ApiError.unauthorized();
  return user;
}

export async function requireSuperAdmin(user: SessionUser | null): Promise<SessionUser> {
  if (!user) throw ApiError.unauthorized();
  if (user.role !== "SUPER_ADMIN") throw ApiError.forbidden("Platform admin access required");
  return user;
}

export async function getClubContext(clubId: string, user: SessionUser): Promise<ClubContext> {
  const club = await prisma.club.findFirst({ where: { id: clubId, deletedAt: null } });
  if (!club) throw ApiError.notFound("Club not found");
  const membership = await prisma.clubMember.findUnique({
    where: { clubId_userId: { clubId, userId: user.id } }
  });
  const active =
    membership && membership.status === "ACTIVE" && !membership.removedAt
      ? { id: membership.id, role: membership.role, status: membership.status, userId: membership.userId }
      : null;
  if (!active && user.role !== "SUPER_ADMIN") throw ApiError.forbidden("You are not a member of this club", "NOT_A_MEMBER");
  return { clubId, club, membership: active, user };
}

export async function requireClubRole(
  clubId: string,
  user: SessionUser,
  roles: readonly string[]
): Promise<ClubContext> {
  const ctx = await getClubContext(clubId, user);
  if (!ctx.membership) {
    if (user.role === "SUPER_ADMIN") return ctx;
    throw ApiError.forbidden("Membership required");
  }
  if (!roles.includes(ctx.membership.role)) {
    throw ApiError.forbidden(`Requires one of roles: ${roles.join(", ")}`);
  }
  return ctx;
}

export async function requireStaff(clubId: string, user: SessionUser): Promise<ClubContext> {
  return requireClubRole(clubId, user, MANAGER_ROLES);
}

export async function requireManagerOrCoach(clubId: string, user: SessionUser): Promise<ClubContext> {
  return requireClubRole(clubId, user, STAFF_ROLES);
}

export async function isStaffOf(clubId: string, user: SessionUser): Promise<boolean> {
  const m = await prisma.clubMember.findUnique({ where: { clubId_userId: { clubId, userId: user.id } } });
  return Boolean(m && m.status === "ACTIVE" && MANAGER_ROLES.includes(m.role as any));
}

export async function assertFeature(club: { subscriptionPlan: string }, feature: Feature): Promise<void> {
  if (!planAllows(club.subscriptionPlan, feature)) {
    throw ApiError.paymentRequired(`This feature requires an upgraded plan (${feature})`, "FEATURE_LOCKED");
  }
}

export async function assertLimit(
  club: { id: string; subscriptionPlan: string },
  kind: "members" | "courts"
): Promise<void> {
  const plan = (club.subscriptionPlan as Plan) ?? "FREE";
  if (!PLAN_LIMITS[plan]) return;
  if (kind === "members") {
    const count = await prisma.clubMember.count({ where: { clubId: club.id, status: "ACTIVE" } }).catch(() => 0);
    if (count >= PLAN_LIMITS[plan].maxMembers) {
      throw ApiError.paymentRequired(`Member limit reached for ${plan} plan`, "PLAN_LIMIT");
    }
  }
}

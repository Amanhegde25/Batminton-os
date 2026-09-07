import { prisma } from "@/server/db";
import { ApiError } from "@/lib/api";
import { DEFAULT_PENALTY_RULES, parseClubSettings, type ClubSettings } from "@/lib/constants";
import { audit } from "./audit";
import type { SessionUser } from "@/server/auth/types";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

async function uniqueSlug(base: string): Promise<string> {
  let candidate = slugify(base) || "club";
  for (let i = 0; i < 50; i++) {
    const taken = await prisma.club.findUnique({ where: { slug: candidate } });
    if (!taken) return candidate;
    candidate = `${slugify(base)}-${i + 2}`;
  }
  throw ApiError.conflict("Could not derive a unique club handle");
}

export async function createClub(user: SessionUser, input: CreateClubInput) {
  const slug = input.slug ? await uniqueSlug(input.slug) : await uniqueSlug(input.name);
  const club = await prisma.club.create({
    data: {
      name: input.name.trim(),
      slug,
      description: input.description,
      city: input.city,
      address: input.address,
      logoUrl: input.logoUrl,
      lat: input.lat,
      lng: input.lng,
      ownerId: user.id,
      subscriptionPlan: "FREE",
      settings: JSON.stringify(parseClubSettings(null)),
      members: { create: { userId: user.id, role: "OWNER", status: "ACTIVE" } },
      penaltyRules: {
        create: DEFAULT_PENALTY_RULES.map((r) => ({
          eventType: r.eventType,
          label: r.label,
          amount: r.amount,
          enabled: r.enabled
        }))
      }
    }
  });
  await audit({
    clubId: club.id,
    actorUserId: user.id,
    action: "club.created",
    entityType: "Club",
    entityId: club.id,
    newValue: { name: club.name }
  });
  return club;
}

export interface CreateClubInput {
  name: string;
  description?: string;
  city?: string;
  address?: string;
  logoUrl?: string;
  slug?: string;
  lat?: number;
  lng?: number;
}

export async function updateClub(clubId: string, user: SessionUser, patch: UpdateClubPatch) {
  const before = await prisma.club.findFirst({ where: { id: clubId, deletedAt: null } });
  if (!before) throw ApiError.notFound("Club not found");
  const settingsBefore = parseClubSettings(before.settings);
  const mergedSettings = patch.settings
    ? mergeSettings(settingsBefore, patch.settings)
    : null;
  const after = await prisma.club.update({
    where: { id: clubId },
    data: {
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.city !== undefined ? { city: patch.city } : {}),
      ...(patch.address !== undefined ? { address: patch.address } : {}),
      ...(patch.logoUrl !== undefined ? { logoUrl: patch.logoUrl } : {}),
      ...(patch.isPublic !== undefined ? { isPublic: patch.isPublic } : {}),
      ...(patch.lat !== undefined ? { lat: patch.lat } : {}),
      ...(patch.lng !== undefined ? { lng: patch.lng } : {}),
      ...(mergedSettings ? { settings: JSON.stringify(mergedSettings) } : {})
    }
  });
  await audit({
    clubId,
    actorUserId: user.id,
    action: patch.settings && !patch.name && !patch.description ? "club.settings_updated" : "club.updated",
    entityType: "Club",
    entityId: clubId,
    previousValue: { name: before.name, settings: settingsBefore },
    newValue: { name: after.name, settings: mergedSettings ?? settingsBefore }
  });
  return after;
}

export interface UpdateClubPatch {
  name?: string;
  description?: string;
  city?: string;
  address?: string;
  logoUrl?: string;
  isPublic?: boolean;
  lat?: number;
  lng?: number;
  settings?: DeepPartial<ClubSettings>;
}

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

function mergeSettings(base: ClubSettings, patch: DeepPartial<ClubSettings>): ClubSettings {
  return {
    ...base,
    ...patch,
    attendance: { ...base.attendance, ...(patch.attendance ?? {}) },
    booking: { ...base.booking, ...(patch.booking ?? {}) },
    membership: { ...base.membership, ...(patch.membership ?? {}) }
  };
}

export async function getClubForUser(clubId: string) {
  const club = await prisma.club.findFirst({
    where: { id: clubId, deletedAt: null },
    include: {
      owner: { select: { id: true, name: true, photoUrl: true } },
      _count: { select: { members: true, courts: true, matches: true } }
    }
  });
  if (!club) throw ApiError.notFound("Club not found");
  return club;
}

export async function listPublicClubs(q?: string, userId?: string) {
  const clubs = await prisma.club.findMany({
    where: { deletedAt: null, isPublic: true, ...(q ? { OR: [{ name: { contains: q } }, { city: { contains: q } }] } : {}) },
    select: {
      id: true,
      name: true,
      slug: true,
      city: true,
      logoUrl: true,
      description: true,
      subscriptionPlan: true,
      _count: { select: { members: true, courts: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 60
  });

  // Look up the current user's memberships for all returned clubs
  let membershipMap = new Map<string, { id: string; status: string; role: string }>();
  if (userId) {
    const memberships = await prisma.clubMember.findMany({
      where: { userId, clubId: { in: clubs.map((c) => c.id) } },
      select: { id: true, clubId: true, status: true, role: true }
    });
    membershipMap = new Map(memberships.map((m) => [m.clubId, { id: m.id, status: m.status, role: m.role }]));
  }

  return clubs.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    city: c.city,
    logoUrl: c.logoUrl,
    description: c.description,
    subscriptionPlan: c.subscriptionPlan,
    memberCount: c._count.members,
    membership: membershipMap.get(c.id) ?? null
  }));
}

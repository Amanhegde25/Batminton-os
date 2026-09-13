import { clubs, clubMembers, penaltyRules } from "@/server/db";
import { ApiError } from "@/lib/api";
import { DEFAULT_PENALTY_RULES, parseClubSettings, type ClubSettings } from "@/lib/constants";
import { audit } from "./audit";
import type { SessionUser } from "@/server/auth/types";
import { cuid } from "@/lib/id";

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
    const taken = await clubs().findOne({ slug: candidate });
    if (!taken) return candidate;
    candidate = `${slugify(base)}-${i + 2}`;
  }
  throw ApiError.conflict("Could not derive a unique club handle");
}

export async function createClub(user: SessionUser, input: CreateClubInput) {
  const slug = input.slug ? await uniqueSlug(input.slug) : await uniqueSlug(input.name);
  const now = new Date();
  const clubId = cuid();
  const club = {
    id: clubId,
    name: input.name.trim(),
    slug,
    description: input.description ?? null,
    city: input.city ?? null,
    address: input.address ?? null,
    logoUrl: input.logoUrl ?? null,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    ownerId: user.id,
    subscriptionPlan: "FREE",
    settings: JSON.stringify(parseClubSettings(null)),
    sport: "BADMINTON",
    isPublic: true,
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  };
  await clubs().insertOne(club);

  // Create owner membership
  await clubMembers().insertOne({
    id: cuid(),
    clubId,
    userId: user.id,
    role: "OWNER",
    status: "ACTIVE",
    joinedAt: now,
    removedAt: null
  });

  // Create default penalty rules
  const rules = DEFAULT_PENALTY_RULES.map((r) => ({
    id: cuid(),
    clubId,
    eventType: r.eventType,
    label: r.label,
    amount: r.amount,
    enabled: r.enabled,
    createdAt: now,
    updatedAt: now
  }));
  if (rules.length > 0) {
    await penaltyRules().insertMany(rules);
  }

  await audit({
    clubId,
    actorUserId: user.id,
    action: "club.created",
    entityType: "Club",
    entityId: clubId,
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
  const before = await clubs().findOne({ id: clubId, deletedAt: null });
  if (!before) throw ApiError.notFound("Club not found");
  const settingsBefore = parseClubSettings(before.settings as string);
  const mergedSettings = patch.settings
    ? mergeSettings(settingsBefore, patch.settings)
    : null;
  const data: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.name !== undefined) data.name = patch.name.trim();
  if (patch.description !== undefined) data.description = patch.description;
  if (patch.city !== undefined) data.city = patch.city;
  if (patch.address !== undefined) data.address = patch.address;
  if (patch.logoUrl !== undefined) data.logoUrl = patch.logoUrl;
  if (patch.isPublic !== undefined) data.isPublic = patch.isPublic;
  if (patch.lat !== undefined) data.lat = patch.lat;
  if (patch.lng !== undefined) data.lng = patch.lng;
  if (mergedSettings) data.settings = JSON.stringify(mergedSettings);

  const after = await clubs().findOneAndUpdate(
    { id: clubId },
    { $set: data },
    { returnDocument: "after" }
  );
  if (!after) throw ApiError.notFound("Club not found");
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
  [K in keyof T]?: T[K] extends object | undefined ? DeepPartial<NonNullable<T[K]>> : T[K];
};

function mergeSettings(base: ClubSettings, patch: DeepPartial<ClubSettings>): ClubSettings {
  return {
    ...base,
    ...patch,
    attendance: { ...base.attendance, ...(patch.attendance ?? {}) },
    booking: { ...base.booking, ...(patch.booking ?? {}) },
    membership: { ...base.membership, ...(patch.membership ?? {}) },
    matchmaking: {
      allowAbsent: patch.matchmaking?.allowAbsent ?? base.matchmaking?.allowAbsent ?? false
    }
  };
}

export async function getClubForUser(clubId: string) {
  const club = await clubs().findOne({ id: clubId, deletedAt: null });
  if (!club) throw ApiError.notFound("Club not found");

  const owner = await (await import("@/server/db")).users().findOne(
    { id: club.ownerId as string },
    { projection: { id: 1, name: 1, photoUrl: 1, _id: 0 } }
  );
  const [memberCount, courtCount, matchCount] = await Promise.all([
    clubMembers().countDocuments({ clubId }),
    (await import("@/server/db")).courts().countDocuments({ clubId }),
    (await import("@/server/db")).matches().countDocuments({ clubId })
  ]);
  return {
    ...club,
    owner,
    _count: { members: memberCount, courts: courtCount, matches: matchCount }
  };
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export interface ListClubsOptions {
  lat?: number;
  lng?: number;
  city?: string;
  excludeClubId?: string;
}

export async function listPublicClubs(q?: string, userId?: string, options?: ListClubsOptions) {
  const filter: Record<string, unknown> = { deletedAt: null, isPublic: true };
  if (options?.excludeClubId) filter.id = { $ne: options.excludeClubId };
  if (q) {
    filter.$or = [
      { name: { $regex: q, $options: "i" } },
      { city: { $regex: q, $options: "i" } },
      { address: { $regex: q, $options: "i" } }
    ];
  }

  const rawClubs = await clubs().find(filter).sort({ createdAt: -1 }).limit(60).toArray();

  // Count members and courts for each club
  const clubIds = rawClubs.map((c) => c.id as string);
  const memberCounts = await clubMembers().aggregate([
    { $match: { clubId: { $in: clubIds } } },
    { $group: { _id: "$clubId", count: { $sum: 1 } } }
  ]).toArray();
  const courtCounts = await (await import("@/server/db")).courts().aggregate([
    { $match: { clubId: { $in: clubIds } } },
    { $group: { _id: "$clubId", count: { $sum: 1 } } }
  ]).toArray();
  const memberCountMap = new Map(memberCounts.map((m) => [m._id, m.count]));
  const courtCountMap = new Map(courtCounts.map((c) => [c._id, c.count]));

  // Look up user's memberships
  let membershipMap = new Map<string, { id: string; status: string; role: string }>();
  if (userId) {
    const memberships = await clubMembers().find(
      { userId, clubId: { $in: clubIds } },
      { projection: { id: 1, clubId: 1, status: 1, role: 1, _id: 0 } }
    ).toArray();
    membershipMap = new Map(memberships.map((m) => [m.clubId as string, { id: m.id as string, status: m.status as string, role: m.role as string }]));
  }

  const results = rawClubs.map((c) => {
    let distanceKm: number | null = null;
    if (options?.lat != null && options?.lng != null && c.lat != null && c.lng != null) {
      distanceKm = haversineKm(options.lat, options.lng, c.lat as number, c.lng as number);
    }
    return {
      id: c.id as string,
      name: c.name as string,
      slug: c.slug as string,
      city: (c.city as string) ?? null,
      address: (c.address as string) ?? null,
      lat: (c.lat as number) ?? null,
      lng: (c.lng as number) ?? null,
      logoUrl: (c.logoUrl as string) ?? null,
      description: (c.description as string) ?? null,
      subscriptionPlan: c.subscriptionPlan as string,
      sport: c.sport as string,
      courtCount: courtCountMap.get(c.id) ?? 0,
      memberCount: memberCountMap.get(c.id) ?? 0,
      distanceKm,
      membership: membershipMap.get(c.id as string) ?? null
    };
  });

  if (options?.lat != null && options?.lng != null) {
    results.sort((a, b) => {
      if (a.distanceKm != null && b.distanceKm != null) return a.distanceKm - b.distanceKm;
      if (a.distanceKm != null) return -1;
      if (b.distanceKm != null) return 1;
      return 0;
    });
  } else if (options?.city) {
    const targetCity = options.city.toLowerCase().trim();
    results.sort((a, b) => {
      const aMatch = a.city?.toLowerCase().trim() === targetCity ? 1 : 0;
      const bMatch = b.city?.toLowerCase().trim() === targetCity ? 1 : 0;
      return bMatch - aMatch;
    });
  }

  return results;
}

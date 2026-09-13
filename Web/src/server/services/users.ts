import { users } from "@/server/db";
import { ApiError } from "@/lib/api";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import type { SessionUser } from "@/server/auth/types";
import { cuid } from "@/lib/id";
import { clubMembers } from "@/server/db";

export function mobileCandidates(raw: string): string[] {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  const set = new Set<string>();
  set.add(trimmed);
  if (digits.length === 10) {
    set.add(digits);
    set.add(`+91${digits}`);
  } else if (digits.length === 12 && digits.startsWith("91")) {
    set.add(digits.slice(2));
    set.add(`+${digits}`);
    set.add(digits);
  }
  return Array.from(set);
}

export async function registerUser(input: {
  name: string;
  email?: string;
  mobile?: string;
  password: string;
  dob?: string;
  gender?: string;
}): Promise<SessionUser> {
  const rawEmail = input.email?.trim().toLowerCase() || null;
  const rawMobile = input.mobile?.trim() || null;

  if (!rawEmail && !rawMobile) {
    throw ApiError.badRequest("Either email or mobile number must be provided");
  }

  if (rawEmail) {
    const existingEmail = await users().findOne({ email: rawEmail });
    if (existingEmail) throw ApiError.conflict("An account with this email already exists");
  }

  if (rawMobile) {
    const candidates = mobileCandidates(rawMobile);
    const existingMobile = await users().findOne({ mobile: { $in: candidates } });
    if (existingMobile) throw ApiError.conflict("An account with this mobile number already exists");
  }

  const now = new Date();
  const user = {
    id: cuid(),
    name: input.name.trim(),
    email: rawEmail,
    mobile: rawMobile,
    aadhar: null,
    hasCompletedSetup: false,
    passwordHash: hashPassword(input.password),
    photoUrl: null,
    dob: input.dob ?? null,
    gender: input.gender ?? null,
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
  await users().insertOne(user);
  return toSessionUser(user);
}

export async function authenticate(identifier: string, password: string): Promise<SessionUser> {
  const trimmed = identifier.trim();
  const candidates = mobileCandidates(trimmed);
  const user = await users().findOne({
    deletedAt: null,
    $or: [
      { email: trimmed.toLowerCase() },
      { mobile: { $in: candidates } }
    ]
  });
  if (!user || !user.passwordHash) throw ApiError.unauthorized("Invalid email/mobile or password");
  if (!verifyPassword(password, user.passwordHash as string)) throw ApiError.unauthorized("Invalid email/mobile or password");
  return toSessionUser(user as any);
}

export async function findOrCreateByMobile(mobile: string, name?: string): Promise<SessionUser> {
  const candidates = mobileCandidates(mobile);
  const user = await users().findOne({ mobile: { $in: candidates } });
  if (user && !user.deletedAt) return toSessionUser(user as any);
  if (user) throw ApiError.forbidden("Account is deactivated");
  const now = new Date();
  const created = {
    id: cuid(),
    name: name?.trim() || `Player ${mobile.slice(-4)}`,
    email: null,
    mobile,
    aadhar: null,
    hasCompletedSetup: false,
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
  await users().insertOne(created);
  return toSessionUser(created);
}

export async function findOrCreateGoogleUser(googleId: string, email: string, name: string, photoUrl?: string): Promise<SessionUser> {
  let user = await users().findOne({ googleId });
  if (!user) {
    user = await users().findOne({ email: email.toLowerCase() });
    if (user) {
      await users().updateOne({ id: user.id }, { $set: { googleId } });
      user = await users().findOne({ id: user.id });
    } else {
      const now = new Date();
      const newUser = {
        id: cuid(),
        googleId,
        email: email.toLowerCase(),
        name,
        photoUrl: photoUrl ?? null,
        mobile: null,
        aadhar: null,
        hasCompletedSetup: false,
        passwordHash: null,
        dob: null,
        gender: null,
        role: "PLAYER",
        skillLevel: null,
        playingStyle: null,
        dominantHand: null,
        preferredTime: null,
        tokenVersion: 0,
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      };
      await users().insertOne(newUser);
      user = newUser;
    }
  }
  return toSessionUser(user as any);
}

export async function completeSetup(
  userId: string,
  input: { email?: string; mobile?: string; aadhar?: string; skip?: boolean }
): Promise<SessionUser> {
  const user = await users().findOne({ id: userId });
  if (!user || user.deletedAt) throw ApiError.notFound("User not found");

  if (input.skip) {
    await users().updateOne(
      { id: userId },
      { $set: { hasCompletedSetup: true, updatedAt: new Date() } }
    );
    const updated = await users().findOne({ id: userId });
    return toSessionUser(updated as any);
  }

  const updates: Record<string, unknown> = {
    hasCompletedSetup: true,
    updatedAt: new Date()
  };

  // Optional Email update/entry
  if (input.email !== undefined && input.email !== null) {
    const trimmedEmail = input.email.trim().toLowerCase();
    if (trimmedEmail) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        throw ApiError.badRequest("Invalid email address format");
      }
      const existingEmail = await users().findOne({
        id: { $ne: userId },
        email: trimmedEmail
      });
      if (existingEmail) throw ApiError.conflict("This email address is already in use");
      updates.email = trimmedEmail;
    }
  }

  // Optional Mobile update/entry
  if (input.mobile !== undefined && input.mobile !== null) {
    const trimmedMobile = input.mobile.trim();
    if (trimmedMobile) {
      const candidates = mobileCandidates(trimmedMobile);
      const existingMobile = await users().findOne({
        id: { $ne: userId },
        mobile: { $in: candidates }
      });
      if (existingMobile) throw ApiError.conflict("This mobile number is already in use");
      updates.mobile = trimmedMobile;
    }
  }

  // Optional Aadhaar update/entry
  if (input.aadhar !== undefined && input.aadhar !== null) {
    const rawAadhar = input.aadhar.replace(/[\s-]/g, "");
    if (rawAadhar) {
      if (!/^\d{12}$/.test(rawAadhar)) {
        throw ApiError.badRequest("Aadhaar number must be exactly 12 digits");
      }
      const existingAadhar = await users().findOne({
        id: { $ne: userId },
        aadhar: rawAadhar
      });
      if (existingAadhar) throw ApiError.conflict("This Aadhaar number is already linked to another account");
      updates.aadhar = rawAadhar;
    }
  }

  await users().updateOne({ id: userId }, { $set: updates });
  const updated = await users().findOne({ id: userId });
  return toSessionUser(updated as any);
}

export interface ProfilePatch {
  name?: string | null;
  email?: string | null;
  photoUrl?: string | null;
  mobile?: string | null;
  aadhar?: string | null;
  dob?: string | null;
  gender?: string | null;
  skillLevel?: string | null;
  playingStyle?: string | null;
  dominantHand?: string | null;
  preferredTime?: string | null;
}

export async function updateProfile(userId: string, patch: ProfilePatch): Promise<SessionUser> {
  const current = await users().findOne({ id: userId });
  if (!current || current.deletedAt) throw ApiError.notFound("User not found");

  const data: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.name !== undefined && patch.name !== null) data.name = patch.name.trim();
  if (patch.photoUrl !== undefined) data.photoUrl = patch.photoUrl;
  if (patch.dob !== undefined) data.dob = patch.dob;
  if (patch.gender !== undefined) data.gender = patch.gender;
  if (patch.skillLevel !== undefined) data.skillLevel = patch.skillLevel;
  if (patch.playingStyle !== undefined) data.playingStyle = patch.playingStyle;
  if (patch.dominantHand !== undefined) data.dominantHand = patch.dominantHand;
  if (patch.preferredTime !== undefined) data.preferredTime = patch.preferredTime;

  let nextEmail: string | null = current.email;
  if (patch.email !== undefined) {
    if (patch.email !== null && patch.email.trim() !== "") {
      const trimmed = patch.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        throw ApiError.badRequest("Invalid email address format");
      }
      const existing = await users().findOne({ id: { $ne: userId }, email: trimmed });
      if (existing) throw ApiError.conflict("This email address is already in use");
      nextEmail = trimmed;
      data.email = trimmed;
    } else {
      nextEmail = null;
      data.email = null;
    }
  }

  let nextMobile: string | null = current.mobile;
  if (patch.mobile !== undefined) {
    if (patch.mobile !== null && patch.mobile.trim() !== "") {
      const trimmed = patch.mobile.trim();
      const candidates = mobileCandidates(trimmed);
      const existing = await users().findOne({ id: { $ne: userId }, mobile: { $in: candidates } });
      if (existing) throw ApiError.conflict("Mobile number already in use");
      nextMobile = trimmed;
      data.mobile = trimmed;
    } else {
      nextMobile = null;
      data.mobile = null;
    }
  }

  // At least one contact method must remain linked (email or mobile)
  if (!nextEmail && !nextMobile) {
    throw ApiError.badRequest("You must have at least an email address or mobile number linked to your account");
  }

  // Aadhaar is completely optional: can be updated, set, or cleared
  if (patch.aadhar !== undefined) {
    if (patch.aadhar !== null && patch.aadhar.trim() !== "") {
      const raw = patch.aadhar.replace(/\D/g, "");
      if (raw.length > 0) {
        if (!/^\d{12}$/.test(raw)) throw ApiError.badRequest("Aadhaar number must be exactly 12 digits");
        const existing = await users().findOne({ id: { $ne: userId }, aadhar: raw });
        if (existing) throw ApiError.conflict("Aadhaar number already in use");
        data.aadhar = raw;
      } else {
        data.aadhar = null;
      }
    } else {
      data.aadhar = null;
    }
  }

  const result = await users().findOneAndUpdate(
    { id: userId },
    { $set: data },
    { returnDocument: "after" }
  );
  if (!result) throw ApiError.notFound("User not found");
  return toSessionUser(result as any);
}

export async function getMe(user: SessionUser) {
  const memberships = await clubMembers().aggregate([
    { $match: { userId: user.id, status: "ACTIVE", removedAt: null } },
    { $sort: { joinedAt: 1 } },
    {
      $lookup: {
        from: "clubs",
        let: { cid: "$clubId" },
        pipeline: [
          { $match: { $expr: { $eq: ["$id", "$$cid"] } } },
          { $project: { id: 1, name: 1, slug: 1, logoUrl: 1, subscriptionPlan: 1, city: 1, _id: 0 } }
        ],
        as: "club"
      }
    },
    { $unwind: "$club" }
  ]).toArray();
  return {
    ...user,
    memberships: memberships.map((m) => ({ role: m.role, joinedAt: m.joinedAt, club: m.club }))
  };
}

export async function getPublicProfile(userId: string) {
  const user = await users().findOne(
    { id: userId, deletedAt: null },
    {
      projection: {
        _id: 0, id: 1, name: 1, photoUrl: 1, gender: 1, skillLevel: 1,
        playingStyle: 1, dominantHand: 1, preferredTime: 1, createdAt: 1
      }
    }
  );
  if (!user) throw ApiError.notFound("Player not found");
  const memberships = await clubMembers().aggregate([
    { $match: { userId, status: "ACTIVE" } },
    {
      $lookup: {
        from: "clubs",
        let: { cid: "$clubId" },
        pipeline: [
          { $match: { $expr: { $eq: ["$id", "$$cid"] } } },
          { $project: { id: 1, name: 1, logoUrl: 1, _id: 0 } }
        ],
        as: "club"
      }
    },
    { $unwind: "$club" },
    { $project: { role: 1, club: 1, _id: 0 } }
  ]).toArray();
  return { ...user, memberships };
}

export async function changePassword(userId: string, current: string | null, next: string): Promise<void> {
  const user = await users().findOne({ id: userId });
  if (!user) throw ApiError.notFound("User not found");
  if (user.passwordHash && current !== null) {
    if (!verifyPassword(current, user.passwordHash as string)) throw ApiError.badRequest("Current password is incorrect");
  }
  await users().updateOne(
    { id: userId },
    { $set: { passwordHash: hashPassword(next), updatedAt: new Date() }, $inc: { tokenVersion: 1 } }
  );
}

function toSessionUser(user: any): SessionUser {
  return {
    id: user.id,
    email: user.email ?? null,
    mobile: user.mobile ?? null,
    aadhar: user.aadhar ?? null,
    hasCompletedSetup: user.hasCompletedSetup ?? false,
    name: user.name,
    photoUrl: user.photoUrl ?? null,
    role: user.role,
    tokenVersion: user.tokenVersion ?? 0
  };
}

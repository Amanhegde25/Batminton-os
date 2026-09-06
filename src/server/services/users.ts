import { prisma } from "@/server/db";
import { ApiError } from "@/lib/api";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import type { SessionUser } from "@/server/auth/types";

export async function registerUser(input: {
  name: string;
  email: string;
  mobile?: string;
  password: string;
  dob?: string;
  gender?: string;
}): Promise<SessionUser> {
  const email = input.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw ApiError.conflict("An account with this email already exists");
  if (input.mobile) {
    const byMobile = await prisma.user.findUnique({ where: { mobile: input.mobile } });
    if (byMobile) throw ApiError.conflict("An account with this mobile number already exists");
  }
  const user = await prisma.user.create({
    data: {
      name: input.name.trim(),
      email,
      mobile: input.mobile,
      passwordHash: hashPassword(input.password),
      dob: input.dob,
      gender: input.gender
    }
  });
  return toSessionUser(user);
}

export async function authenticate(email: string, password: string): Promise<SessionUser> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user || user.deletedAt || !user.passwordHash) throw ApiError.unauthorized("Invalid email or password");
  if (!verifyPassword(password, user.passwordHash)) throw ApiError.unauthorized("Invalid email or password");
  return toSessionUser(user);
}

export async function findOrCreateByMobile(mobile: string, name?: string): Promise<SessionUser> {
  const user = await prisma.user.findUnique({ where: { mobile } });
  if (user && !user.deletedAt) return toSessionUser(user);
  if (user) throw ApiError.forbidden("Account is deactivated");
  const created = await prisma.user.create({
    data: { name: name?.trim() || `Player ${mobile.slice(-4)}`, email: `${mobile}@otp.local`, mobile }
  });
  return toSessionUser(created);
}

export async function findOrCreateGoogleUser(googleId: string, email: string, name: string, photoUrl?: string): Promise<SessionUser> {
  let user = await prisma.user.findUnique({ where: { googleId } });
  if (!user) {
    user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (user) {
      user = await prisma.user.update({ where: { id: user.id }, data: { googleId } });
    } else {
      user = await prisma.user.create({ data: { googleId, email: email.toLowerCase(), name, photoUrl } });
    }
  }
  return toSessionUser(user);
}

export async function updateProfile(userId: string, patch: ProfilePatch): Promise<SessionUser> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.photoUrl !== undefined ? { photoUrl: patch.photoUrl } : {}),
      ...(patch.mobile !== undefined ? { mobile: patch.mobile } : {}),
      ...(patch.dob !== undefined ? { dob: patch.dob } : {}),
      ...(patch.gender !== undefined ? { gender: patch.gender } : {}),
      ...(patch.skillLevel !== undefined ? { skillLevel: patch.skillLevel } : {}),
      ...(patch.playingStyle !== undefined ? { playingStyle: patch.playingStyle } : {}),
      ...(patch.dominantHand !== undefined ? { dominantHand: patch.dominantHand } : {}),
      ...(patch.preferredTime !== undefined ? { preferredTime: patch.preferredTime } : {})
    }
  });
  return toSessionUser(user);
}

export interface ProfilePatch {
  name?: string;
  photoUrl?: string;
  mobile?: string;
  dob?: string;
  gender?: string;
  skillLevel?: string;
  playingStyle?: string;
  dominantHand?: string;
  preferredTime?: string;
}

export async function getMe(user: SessionUser) {
  const memberships = await prisma.clubMember.findMany({
    where: { userId: user.id, status: "ACTIVE", removedAt: null },
    include: { club: { select: { id: true, name: true, slug: true, logoUrl: true, subscriptionPlan: true, city: true } } },
    orderBy: { joinedAt: "asc" }
  });
  return {
    ...user,
    memberships: memberships.map((m) => ({ role: m.role, joinedAt: m.joinedAt, club: m.club }))
  };
}

export async function getPublicProfile(userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      name: true,
      photoUrl: true,
      gender: true,
      skillLevel: true,
      playingStyle: true,
      dominantHand: true,
      preferredTime: true,
      createdAt: true,
      memberships: {
        where: { status: "ACTIVE" },
        select: { role: true, club: { select: { id: true, name: true, logoUrl: true } } }
      }
    }
  });
  if (!user) throw ApiError.notFound("Player not found");
  return user;
}

export async function changePassword(userId: string, current: string | null, next: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound("User not found");
  if (user.passwordHash && current !== null) {
    if (!verifyPassword(current, user.passwordHash)) throw ApiError.badRequest("Current password is incorrect");
  }
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: hashPassword(next), tokenVersion: { increment: 1 } }
  });
}

function toSessionUser(user: {
  id: string;
  email: string;
  mobile: string | null;
  name: string;
  photoUrl: string | null;
  role: string;
  tokenVersion: number;
}): SessionUser {
  return {
    id: user.id,
    email: user.email,
    mobile: user.mobile,
    name: user.name,
    photoUrl: user.photoUrl,
    role: user.role,
    tokenVersion: user.tokenVersion
  };
}

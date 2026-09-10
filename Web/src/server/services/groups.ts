import { prisma } from "@/server/db";
import { ApiError } from "@/lib/api";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

async function uniqueSlug(base: string): Promise<string> {
  let candidate = slugify(base) || "group";
  for (let i = 0; i < 50; i++) {
    const taken = await prisma.playGroup.findUnique({ where: { slug: candidate } });
    if (!taken) return candidate;
    candidate = `${slugify(base)}-${i + 2}`;
  }
  throw ApiError.conflict("Could not derive a unique group handle");
}

export interface CreateGroupInput {
  name: string;
  description?: string;
  city?: string;
  skillLevel?: string;
  isPublic?: boolean;
  logoUrl?: string;
}

export async function createGroup(userId: string, input: CreateGroupInput) {
  const name = input.name.trim();
  if (!name) throw ApiError.badRequest("Group name is required");

  const slug = await uniqueSlug(name);

  const group = await prisma.playGroup.create({
    data: {
      name,
      slug,
      description: input.description?.trim(),
      city: input.city?.trim() || null,
      skillLevel: input.skillLevel || "ALL",
      isPublic: input.isPublic ?? true,
      logoUrl: input.logoUrl || null,
      createdById: userId,
      members: {
        create: {
          userId,
          role: "LEADER",
          status: "ACTIVE"
        }
      }
    },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, photoUrl: true } }
        }
      }
    }
  });

  return group;
}

export async function listGroups(
  userId: string,
  options?: { city?: string; q?: string; myOnly?: boolean }
) {
  const where: any = {
    deletedAt: null
  };

  if (options?.myOnly) {
    where.members = {
      some: { userId, status: "ACTIVE" }
    };
  } else {
    where.OR = [
      { isPublic: true },
      { members: { some: { userId } } }
    ];
  }

  if (options?.city) {
    where.city = { contains: options.city };
  }

  if (options?.q) {
    where.OR = [
      { name: { contains: options.q } },
      { description: { contains: options.q } },
      { city: { contains: options.q } }
    ];
  }

  const groups = await prisma.playGroup.findMany({
    where,
    include: {
      _count: {
        select: {
          members: true,
          sessions: true
        }
      },
      members: {
        where: { userId },
        select: { id: true, role: true, status: true }
      },
      sessions: {
        where: {
          scheduledDate: { gte: new Date() },
          status: "SCHEDULED"
        },
        orderBy: { scheduledDate: "asc" },
        take: 1,
        select: {
          id: true,
          title: true,
          scheduledDate: true,
          clubName: true,
          maxPlayers: true,
          _count: {
            select: { rsvps: { where: { status: "YES" } } }
          }
        }
      }
    },
    orderBy: { createdAt: "desc" },
    take: 50
  });

  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    slug: g.slug,
    description: g.description,
    city: g.city,
    skillLevel: g.skillLevel,
    isPublic: g.isPublic,
    logoUrl: g.logoUrl,
    createdAt: g.createdAt,
    memberCount: g._count.members,
    totalSessions: g._count.sessions,
    myMembership: g.members[0] ?? null,
    nextSession: g.sessions[0]
      ? {
          id: g.sessions[0].id,
          title: g.sessions[0].title,
          scheduledDate: g.sessions[0].scheduledDate,
          clubName: g.sessions[0].clubName,
          maxPlayers: g.sessions[0].maxPlayers,
          confirmedRsvps: g.sessions[0]._count.rsvps
        }
      : null
  }));
}

export async function getGroup(groupId: string, userId?: string) {
  const group = await prisma.playGroup.findFirst({
    where: { id: groupId, deletedAt: null },
    include: {
      createdBy: {
        select: { id: true, name: true, photoUrl: true }
      },
      members: {
        where: { status: "ACTIVE" },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              photoUrl: true,
              skillLevel: true,
              role: true
            }
          }
        },
        orderBy: { joinedAt: "asc" }
      },
      sessions: {
        orderBy: { scheduledDate: "desc" },
        take: 20,
        include: {
          club: {
            select: { id: true, name: true, city: true, address: true, logoUrl: true }
          },
          rsvps: {
            include: {
              user: { select: { id: true, name: true, photoUrl: true } }
            }
          }
        }
      },
      posts: {
        orderBy: { createdAt: "desc" },
        take: 30,
        include: {
          user: { select: { id: true, name: true, photoUrl: true } }
        }
      },
      _count: {
        select: { members: true, sessions: true }
      }
    }
  });

  if (!group) throw ApiError.notFound("Group not found");

  const myMembership = userId
    ? group.members.find((m) => m.userId === userId) ?? null
    : null;

  return {
    ...group,
    myMembership
  };
}

export async function joinGroup(groupId: string, userId: string) {
  const group = await prisma.playGroup.findFirst({ where: { id: groupId, deletedAt: null } });
  if (!group) throw ApiError.notFound("Group not found");

  const existing = await prisma.playGroupMember.findUnique({
    where: { groupId_userId: { groupId, userId } }
  });

  if (existing) {
    if (existing.status === "ACTIVE") return existing;
    return prisma.playGroupMember.update({
      where: { id: existing.id },
      data: { status: "ACTIVE" }
    });
  }

  return prisma.playGroupMember.create({
    data: {
      groupId,
      userId,
      role: "MEMBER",
      status: group.isPublic ? "ACTIVE" : "PENDING"
    }
  });
}

export async function leaveGroup(groupId: string, userId: string) {
  const existing = await prisma.playGroupMember.findUnique({
    where: { groupId_userId: { groupId, userId } }
  });

  if (!existing) return { success: true };

  // If the leaving user is the sole LEADER, either promote another or error
  if (existing.role === "LEADER") {
    const otherLeader = await prisma.playGroupMember.findFirst({
      where: { groupId, userId: { not: userId }, role: "LEADER", status: "ACTIVE" }
    });
    if (!otherLeader) {
      const anotherMember = await prisma.playGroupMember.findFirst({
        where: { groupId, userId: { not: userId }, status: "ACTIVE" }
      });
      if (anotherMember) {
        await prisma.playGroupMember.update({
          where: { id: anotherMember.id },
          data: { role: "LEADER" }
        });
      }
    }
  }

  await prisma.playGroupMember.delete({ where: { id: existing.id } });
  return { success: true };
}

export interface CreateSessionInput {
  title: string;
  clubId?: string;
  clubName?: string;
  clubAddress?: string;
  scheduledDate: string | Date;
  durationMinutes?: number;
  maxPlayers?: number;
  costPerPlayer?: number;
  notes?: string;
}

export async function createGroupSession(
  groupId: string,
  userId: string,
  input: CreateSessionInput
) {
  const group = await prisma.playGroup.findFirst({ where: { id: groupId, deletedAt: null } });
  if (!group) throw ApiError.notFound("Group not found");

  // Verify caller is active member
  const member = await prisma.playGroupMember.findUnique({
    where: { groupId_userId: { groupId, userId } }
  });
  if (!member || member.status !== "ACTIVE") {
    throw ApiError.forbidden("You must be an active member of this group to schedule a session");
  }

  let finalClubName = input.clubName?.trim() || "Local Badminton Court";
  let finalClubAddress = input.clubAddress?.trim() || null;

  if (input.clubId) {
    const club = await prisma.club.findUnique({ where: { id: input.clubId } });
    if (club) {
      finalClubName = club.name;
      finalClubAddress = club.address ? `${club.address}, ${club.city}` : club.city || null;
    }
  }

  const session = await prisma.playGroupSession.create({
    data: {
      groupId,
      title: input.title.trim() || "Group Badminton Session",
      clubId: input.clubId || null,
      clubName: finalClubName,
      clubAddress: finalClubAddress,
      scheduledDate: new Date(input.scheduledDate),
      durationMinutes: input.durationMinutes || 60,
      maxPlayers: input.maxPlayers || 4,
      costPerPlayer: input.costPerPlayer ? Math.round(input.costPerPlayer) : null,
      notes: input.notes?.trim() || null,
      createdById: userId,
      rsvps: {
        create: {
          userId,
          status: "YES"
        }
      }
    },
    include: {
      club: { select: { id: true, name: true, city: true, address: true } },
      rsvps: {
        include: {
          user: { select: { id: true, name: true, photoUrl: true } }
        }
      }
    }
  });

  return session;
}

export async function rsvpSession(
  sessionId: string,
  userId: string,
  status: "YES" | "MAYBE" | "NO"
) {
  const session = await prisma.playGroupSession.findUnique({
    where: { id: sessionId },
    include: {
      group: {
        include: {
          members: { where: { userId, status: "ACTIVE" } }
        }
      },
      rsvps: { where: { status: "YES" } }
    }
  });

  if (!session) throw ApiError.notFound("Session not found");

  if (session.group.members.length === 0) {
    throw ApiError.forbidden("You must join this group before RSVPing to its sessions");
  }

  // Check spot capacity if status is YES
  if (status === "YES") {
    const currentYesCount = session.rsvps.filter((r) => r.userId !== userId).length;
    if (currentYesCount >= session.maxPlayers) {
      throw ApiError.badRequest("This session is already at maximum player capacity");
    }
  }

  const rsvp = await prisma.playGroupSessionRsvp.upsert({
    where: { sessionId_userId: { sessionId, userId } },
    create: { sessionId, userId, status },
    update: { status },
    include: {
      user: { select: { id: true, name: true, photoUrl: true } }
    }
  });

  return rsvp;
}

export async function postMessage(groupId: string, userId: string, content: string) {
  const text = content.trim();
  if (!text) throw ApiError.badRequest("Message content cannot be empty");

  const member = await prisma.playGroupMember.findUnique({
    where: { groupId_userId: { groupId, userId } }
  });
  if (!member || member.status !== "ACTIVE") {
    throw ApiError.forbidden("Must be an active member of this group to post");
  }

  return prisma.playGroupPost.create({
    data: {
      groupId,
      userId,
      content: text
    },
    include: {
      user: { select: { id: true, name: true, photoUrl: true } }
    }
  });
}

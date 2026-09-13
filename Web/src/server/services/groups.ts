import { playGroups, playGroupMembers, playGroupSessions, playGroupSessionRsvps, playGroupPosts, users, clubs } from "@/server/db";
import { ApiError } from "@/lib/api";
import { cuid } from "@/lib/id";

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
    const taken = await playGroups().findOne({ slug: candidate });
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
  const now = new Date();
  const groupId = cuid();
  const memberId = cuid();

  const groupDoc = {
    id: groupId,
    name,
    slug,
    description: input.description?.trim() || null,
    city: input.city?.trim() || null,
    skillLevel: input.skillLevel || "ALL",
    isPublic: input.isPublic ?? true,
    logoUrl: input.logoUrl || null,
    createdById: userId,
    deletedAt: null,
    createdAt: now,
    updatedAt: now
  };

  const memberDoc = {
    id: memberId,
    groupId,
    userId,
    role: "LEADER",
    status: "ACTIVE",
    joinedAt: now
  };

  await playGroups().insertOne(groupDoc);
  await playGroupMembers().insertOne(memberDoc);

  const creatorUser = await users().findOne({ id: userId }, { projection: { id: 1, name: 1, photoUrl: 1 } });

  return {
    ...groupDoc,
    members: [
      {
        ...memberDoc,
        user: creatorUser ? { id: creatorUser.id, name: creatorUser.name, photoUrl: creatorUser.photoUrl } : null
      }
    ]
  };
}

export async function listGroups(
  userId: string,
  options?: { city?: string; q?: string; myOnly?: boolean }
) {
  const userMemberships = await playGroupMembers().find({ userId }).toArray();
  const myActiveGroupIds = userMemberships.filter((m) => m.status === "ACTIVE").map((m) => m.groupId as string);
  const myAllGroupIds = userMemberships.map((m) => m.groupId as string);

  const filter: Record<string, unknown> = { deletedAt: null };

  if (options?.myOnly) {
    filter.id = { $in: myActiveGroupIds };
  } else {
    filter.$or = [
      { isPublic: true },
      { id: { $in: myAllGroupIds } }
    ];
  }

  if (options?.city) {
    filter.city = { $regex: options.city, $options: "i" };
  }

  if (options?.q) {
    const qRegex = { $regex: options.q, $options: "i" };
    filter.$and = [
      ...(filter.$or ? [{ $or: filter.$or as unknown[] }] : []),
      {
        $or: [
          { name: qRegex },
          { description: qRegex },
          { city: qRegex }
        ]
      }
    ];
    delete filter.$or;
  }

  const groupDocs = await playGroups().find(filter).sort({ createdAt: -1 }).limit(50).toArray();
  const groupIds = groupDocs.map((g) => g.id as string);

  if (groupIds.length === 0) return [];

  const [memberCounts, sessionCounts, userMembersInGroups, nextSessions] = await Promise.all([
    playGroupMembers().aggregate([
      { $match: { groupId: { $in: groupIds }, status: "ACTIVE" } },
      { $group: { _id: "$groupId", count: { $sum: 1 } } }
    ]).toArray(),
    playGroupSessions().aggregate([
      { $match: { groupId: { $in: groupIds } } },
      { $group: { _id: "$groupId", count: { $sum: 1 } } }
    ]).toArray(),
    playGroupMembers().find({ groupId: { $in: groupIds }, userId }).toArray(),
    playGroupSessions().find({
      groupId: { $in: groupIds },
      scheduledDate: { $gte: new Date() },
      status: "SCHEDULED"
    }).sort({ scheduledDate: 1 }).toArray()
  ]);

  const memberCountMap = new Map(memberCounts.map((m) => [m._id as string, m.count as number]));
  const sessionCountMap = new Map(sessionCounts.map((s) => [s._id as string, s.count as number]));
  const userMemberMap = new Map(userMembersInGroups.map((m) => [m.groupId as string, m]));

  const nextSessionByGroup = new Map<string, any>();
  for (const s of nextSessions) {
    const gid = s.groupId as string;
    if (!nextSessionByGroup.has(gid)) {
      nextSessionByGroup.set(gid, s);
    }
  }

  const nextSessionIds = Array.from(nextSessionByGroup.values()).map((s) => s.id as string);
  const rsvpYesCounts = nextSessionIds.length > 0
    ? await playGroupSessionRsvps().aggregate([
        { $match: { sessionId: { $in: nextSessionIds }, status: "YES" } },
        { $group: { _id: "$sessionId", count: { $sum: 1 } } }
      ]).toArray()
    : [];
  const rsvpMap = new Map(rsvpYesCounts.map((r) => [r._id as string, r.count as number]));

  return groupDocs.map((g) => {
    const gid = g.id as string;
    const nextSession = nextSessionByGroup.get(gid);
    const myMem = userMemberMap.get(gid);
    return {
      id: gid,
      name: g.name,
      slug: g.slug,
      description: g.description,
      city: g.city,
      skillLevel: g.skillLevel,
      isPublic: g.isPublic,
      logoUrl: g.logoUrl,
      createdAt: g.createdAt,
      memberCount: memberCountMap.get(gid) || 0,
      totalSessions: sessionCountMap.get(gid) || 0,
      myMembership: myMem ? { id: myMem.id, role: myMem.role, status: myMem.status } : null,
      nextSession: nextSession
        ? {
            id: nextSession.id,
            title: nextSession.title,
            scheduledDate: nextSession.scheduledDate,
            clubName: nextSession.clubName,
            maxPlayers: nextSession.maxPlayers,
            confirmedRsvps: rsvpMap.get(nextSession.id as string) || 0
          }
        : null
    };
  });
}

export async function getGroup(groupId: string, userId?: string) {
  const group = await playGroups().findOne({ id: groupId, deletedAt: null });
  if (!group) throw ApiError.notFound("Group not found");

  const [creator, activeMembers, sessions, posts, totalMemberCount, totalSessionCount] = await Promise.all([
    group.createdById ? users().findOne({ id: group.createdById }, { projection: { id: 1, name: 1, photoUrl: 1 } }) : null,
    playGroupMembers().find({ groupId, status: "ACTIVE" }).sort({ joinedAt: 1 }).toArray(),
    playGroupSessions().find({ groupId }).sort({ scheduledDate: -1 }).limit(20).toArray(),
    playGroupPosts().find({ groupId }).sort({ createdAt: -1 }).limit(30).toArray(),
    playGroupMembers().countDocuments({ groupId, status: "ACTIVE" }),
    playGroupSessions().countDocuments({ groupId })
  ]);

  const memberUserIds = activeMembers.map((m) => m.userId as string);
  const postUserIds = posts.map((p) => p.userId as string);
  const sessionIds = sessions.map((s) => s.id as string);
  const sessionClubIds = sessions.map((s) => s.clubId as string).filter(Boolean);

  const [memberUsers, sessionRsvps, sessionClubs, postUsers] = await Promise.all([
    users().find({ id: { $in: memberUserIds } }, { projection: { id: 1, name: 1, photoUrl: 1, skillLevel: 1, role: 1 } }).toArray(),
    sessionIds.length > 0 ? playGroupSessionRsvps().find({ sessionId: { $in: sessionIds } }).toArray() : [],
    sessionClubIds.length > 0 ? clubs().find({ id: { $in: sessionClubIds } }, { projection: { id: 1, name: 1, city: 1, address: 1, logoUrl: 1 } }).toArray() : [],
    postUserIds.length > 0 ? users().find({ id: { $in: postUserIds } }, { projection: { id: 1, name: 1, photoUrl: 1 } }).toArray() : []
  ]);

  const rsvpUserIds = sessionRsvps.map((r) => r.userId as string);
  const rsvpUsers = rsvpUserIds.length > 0
    ? await users().find({ id: { $in: rsvpUserIds } }, { projection: { id: 1, name: 1, photoUrl: 1 } }).toArray()
    : [];

  const userMap = new Map(memberUsers.map((u) => [u.id as string, u]));
  const postUserMap = new Map(postUsers.map((u) => [u.id as string, { id: u.id, name: u.name, photoUrl: u.photoUrl }]));
  const rsvpUserMap = new Map(rsvpUsers.map((u) => [u.id as string, { id: u.id, name: u.name, photoUrl: u.photoUrl }]));
  const clubMap = new Map(sessionClubs.map((c) => [c.id as string, c]));

  const rsvpsBySession = new Map<string, any[]>();
  for (const r of sessionRsvps) {
    const sid = r.sessionId as string;
    const list = rsvpsBySession.get(sid) || [];
    list.push({
      ...r,
      user: rsvpUserMap.get(r.userId as string) || null
    });
    rsvpsBySession.set(sid, list);
  }

  const mappedMembers = activeMembers.map((m) => {
    const u = userMap.get(m.userId as string);
    return {
      ...m,
      user: u ? { id: u.id, name: u.name, photoUrl: u.photoUrl, skillLevel: u.skillLevel, role: u.role } : null
    };
  });

  const mappedSessions = sessions.map((s) => ({
    ...s,
    club: s.clubId ? clubMap.get(s.clubId as string) || null : null,
    rsvps: rsvpsBySession.get(s.id as string) || []
  }));

  const mappedPosts = posts.map((p) => ({
    ...p,
    user: postUserMap.get(p.userId as string) || null
  }));

  const myMembership = userId
    ? mappedMembers.find((m: any) => m.userId === userId) ?? null
    : null;

  return {
    ...group,
    createdBy: creator ? { id: creator.id, name: creator.name, photoUrl: creator.photoUrl } : null,
    members: mappedMembers,
    sessions: mappedSessions,
    posts: mappedPosts,
    _count: {
      members: totalMemberCount,
      sessions: totalSessionCount
    },
    myMembership
  };
}

export async function joinGroup(groupId: string, userId: string) {
  const group = await playGroups().findOne({ id: groupId, deletedAt: null });
  if (!group) throw ApiError.notFound("Group not found");

  const existing = await playGroupMembers().findOne({ groupId, userId });

  if (existing) {
    if (existing.status === "ACTIVE") return existing;
    await playGroupMembers().updateOne({ id: existing.id }, { $set: { status: "ACTIVE" } });
    return { ...existing, status: "ACTIVE" };
  }

  const newMember = {
    id: cuid(),
    groupId,
    userId,
    role: "MEMBER",
    status: group.isPublic ? "ACTIVE" : "PENDING",
    joinedAt: new Date()
  };

  await playGroupMembers().insertOne(newMember);
  return newMember;
}

export async function leaveGroup(groupId: string, userId: string) {
  const existing = await playGroupMembers().findOne({ groupId, userId });

  if (!existing) return { success: true };

  // If the leaving user is the sole LEADER, either promote another or error
  if (existing.role === "LEADER") {
    const otherLeader = await playGroupMembers().findOne({
      groupId,
      userId: { $ne: userId },
      role: "LEADER",
      status: "ACTIVE"
    });
    if (!otherLeader) {
      const anotherMember = await playGroupMembers().findOne({
        groupId,
        userId: { $ne: userId },
        status: "ACTIVE"
      });
      if (anotherMember) {
        await playGroupMembers().updateOne({ id: anotherMember.id }, { $set: { role: "LEADER" } });
      }
    }
  }

  await playGroupMembers().deleteOne({ id: existing.id });
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
  const group = await playGroups().findOne({ id: groupId, deletedAt: null });
  if (!group) throw ApiError.notFound("Group not found");

  // Verify caller is active member
  const member = await playGroupMembers().findOne({ groupId, userId });
  if (!member || member.status !== "ACTIVE") {
    throw ApiError.forbidden("You must be an active member of this group to schedule a session");
  }

  let finalClubName = input.clubName?.trim() || "Local Badminton Court";
  let finalClubAddress = input.clubAddress?.trim() || null;
  let clubDoc: any = null;

  if (input.clubId) {
    clubDoc = await clubs().findOne({ id: input.clubId }, { projection: { id: 1, name: 1, city: 1, address: 1 } });
    if (clubDoc) {
      finalClubName = clubDoc.name;
      finalClubAddress = clubDoc.address ? `${clubDoc.address}, ${clubDoc.city}` : clubDoc.city || null;
    }
  }

  const sessionId = cuid();
  const rsvpId = cuid();
  const now = new Date();

  const sessionDoc = {
    id: sessionId,
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
    status: "SCHEDULED",
    createdById: userId,
    createdAt: now,
    updatedAt: now
  };

  const rsvpDoc = {
    id: rsvpId,
    sessionId,
    userId,
    status: "YES",
    createdAt: now,
    updatedAt: now
  };

  await playGroupSessions().insertOne(sessionDoc);
  await playGroupSessionRsvps().insertOne(rsvpDoc);

  const creatorUser = await users().findOne({ id: userId }, { projection: { id: 1, name: 1, photoUrl: 1 } });

  return {
    ...sessionDoc,
    club: clubDoc ? { id: clubDoc.id, name: clubDoc.name, city: clubDoc.city, address: clubDoc.address } : null,
    rsvps: [
      {
        ...rsvpDoc,
        user: creatorUser ? { id: creatorUser.id, name: creatorUser.name, photoUrl: creatorUser.photoUrl } : null
      }
    ]
  };
}

export async function rsvpSession(
  sessionId: string,
  userId: string,
  status: "YES" | "MAYBE" | "NO"
) {
  const session = await playGroupSessions().findOne({ id: sessionId });
  if (!session) throw ApiError.notFound("Session not found");

  const member = await playGroupMembers().findOne({
    groupId: session.groupId,
    userId,
    status: "ACTIVE"
  });

  if (!member) {
    throw ApiError.forbidden("You must join this group before RSVPing to its sessions");
  }

  // Check spot capacity if status is YES
  if (status === "YES") {
    const currentYesCount = await playGroupSessionRsvps().countDocuments({
      sessionId,
      status: "YES",
      userId: { $ne: userId }
    });
    if (currentYesCount >= (session.maxPlayers as number)) {
      throw ApiError.badRequest("This session is already at maximum player capacity");
    }
  }

  const existingRsvp = await playGroupSessionRsvps().findOne({ sessionId, userId });
  const now = new Date();

  if (existingRsvp) {
    await playGroupSessionRsvps().updateOne(
      { sessionId, userId },
      { $set: { status, updatedAt: now } }
    );
  } else {
    await playGroupSessionRsvps().insertOne({
      id: cuid(),
      sessionId,
      userId,
      status,
      createdAt: now,
      updatedAt: now
    });
  }

  const updatedRsvp = await playGroupSessionRsvps().findOne({ sessionId, userId });
  const user = await users().findOne({ id: userId }, { projection: { id: 1, name: 1, photoUrl: 1 } });

  return {
    ...updatedRsvp,
    user: user ? { id: user.id, name: user.name, photoUrl: user.photoUrl } : null
  };
}

export async function postMessage(groupId: string, userId: string, content: string) {
  const text = content.trim();
  if (!text) throw ApiError.badRequest("Message content cannot be empty");

  const member = await playGroupMembers().findOne({
    groupId,
    userId,
    status: "ACTIVE"
  });
  if (!member) {
    throw ApiError.forbidden("Must be an active member of this group to post");
  }

  const postDoc = {
    id: cuid(),
    groupId,
    userId,
    content: text,
    createdAt: new Date()
  };

  await playGroupPosts().insertOne(postDoc);
  const user = await users().findOne({ id: userId }, { projection: { id: 1, name: 1, photoUrl: 1 } });

  return {
    ...postDoc,
    user: user ? { id: user.id, name: user.name, photoUrl: user.photoUrl } : null
  };
}

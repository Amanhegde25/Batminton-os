import { describe, expect, it } from "vitest";
import { prisma } from "../src/server/db";
import {
  createGroup,
  joinGroup,
  leaveGroup,
  createGroupSession,
  rsvpSession,
  listGroups,
  getGroup
} from "../src/server/services/groups";

describe("Play Groups (Cross-Club Squads)", () => {
  it("creates a play group with unique slug and sets creator as leader", async () => {
    const user = await prisma.user.findFirst();
    expect(user).toBeDefined();

    const group = await createGroup(user!.id, {
      name: "Test Friday Smashers",
      city: "Bengaluru",
      skillLevel: "INTERMEDIATE",
      description: "Friday evening competitive matches"
    });

    expect(group.id).toBeDefined();
    expect(group.slug).toContain("test-friday-smashers");
    expect(group.createdById).toBe(user!.id);
    expect(group.members[0].role).toBe("LEADER");
    expect(group.members[0].status).toBe("ACTIVE");
  });

  it("handles member joining and leaving", async () => {
    const users = await prisma.user.findMany({ take: 2 });
    expect(users.length).toBeGreaterThanOrEqual(2);

    const group = await createGroup(users[0].id, {
      name: "Weekend Doubles Club",
      city: "Bengaluru"
    });

    // User 2 joins
    const member = await joinGroup(group.id, users[1].id);
    expect(member.userId).toBe(users[1].id);
    expect(member.role).toBe("MEMBER");
    expect(member.status).toBe("ACTIVE");

    // Check roster count
    const details = await getGroup(group.id, users[0].id);
    expect(details.members.length).toBe(2);

    // User 2 leaves
    const leaveResult = await leaveGroup(group.id, users[1].id);
    expect(leaveResult.success).toBe(true);

    const updatedDetails = await getGroup(group.id, users[0].id);
    expect(updatedDetails.members.length).toBe(1);
  });

  it("schedules a cross-club session and handles RSVPs with capacity limits", async () => {
    const users = await prisma.user.findMany({ take: 3 });
    const club = await prisma.club.findFirst();
    expect(club).toBeDefined();

    const group = await createGroup(users[0].id, {
      name: "Doubles Quartet",
      city: "Bengaluru"
    });

    // Add 2 more members
    await joinGroup(group.id, users[1].id);
    await joinGroup(group.id, users[2].id);

    // Schedule a 2-player max session
    const tomorrow = new Date(Date.now() + 86400000);
    const session = await createGroupSession(group.id, users[0].id, {
      title: "Court 1 Matchup",
      clubId: club!.id,
      scheduledDate: tomorrow,
      durationMinutes: 60,
      maxPlayers: 2, // only 2 spots
      costPerPlayer: 15000
    });

    expect(session.id).toBeDefined();
    expect(session.clubName).toBe(club!.name);
    // Creator is automatically RSVP'd YES (1/2 spots taken)
    expect(session.rsvps.length).toBe(1);
    expect(session.rsvps[0].status).toBe("YES");

    // Second user RSVPs YES (2/2 spots taken, now FULL)
    const rsvp2 = await rsvpSession(session.id, users[1].id, "YES");
    expect(rsvp2.status).toBe("YES");

    // Third user tries to RSVP YES when session is full -> should throw
    await expect(rsvpSession(session.id, users[2].id, "YES")).rejects.toThrow(
      "maximum player capacity"
    );

    // Third user can still RSVP MAYBE
    const rsvpMaybe = await rsvpSession(session.id, users[2].id, "MAYBE");
    expect(rsvpMaybe.status).toBe("MAYBE");
  });

  it("lists groups with nextSession teaser and member filters", async () => {
    const user = await prisma.user.findFirst();
    const myGroups = await listGroups(user!.id, { myOnly: true });

    expect(Array.isArray(myGroups)).toBe(true);
    expect(myGroups.length).toBeGreaterThan(0);

    const first = myGroups[0];
    expect(first.memberCount).toBeGreaterThanOrEqual(1);
    expect(first.myMembership).toBeDefined();
  });
});

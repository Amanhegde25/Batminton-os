import { describe, expect, it } from "vitest";
import { users, clubMembers } from "../src/server/db";
import { createClub } from "../src/server/services/clubs";
import { addMember, listMembers } from "../src/server/services/members";
import { createMatch, completeMatch } from "../src/server/services/matches";
import { updateProfile } from "../src/server/services/users";

describe("Club Member Directory & Win/Loss Statistics", () => {
  it("computes club and lifetime wins and losses, and respects privacy setting", async () => {
    const allUsers = await users().find().limit(3).toArray();
    expect(allUsers.length).toBeGreaterThanOrEqual(2);

    const userA = allUsers[0] as any;
    const userB = allUsers[1] as any;

    const actorA = {
      id: userA.id,
      email: userA.email,
      name: userA.name,
      role: "PLAYER",
      tokenVersion: 1
    };

    // Create Club 1 & Club 2
    const club1 = await createClub(actorA, {
      name: `MemberStats Club1 ${Date.now()}`,
      city: "Bengaluru"
    });
    const club2 = await createClub(actorA, {
      name: `MemberStats Club2 ${Date.now()}`,
      city: "Bengaluru"
    });

    // Add userB as a regular PLAYER in both clubs
    const m1 = await addMember(club1.id, actorA, {
      email: userB.email || `b_stats_${Date.now()}@test.club`,
      name: userB.name,
      role: "PLAYER"
    });
    await clubMembers().updateOne({ id: m1.id }, { $set: { userId: userB.id } });

    const m2 = await addMember(club2.id, actorA, {
      email: userB.email || `b_stats2_${Date.now()}@test.club`,
      name: userB.name,
      role: "PLAYER"
    });
    await clubMembers().updateOne({ id: m2.id }, { $set: { userId: userB.id } });

    // Enable stats for userB initially
    await updateProfile(userB.id, { showMatchStats: true });

    // Match in Club 1: userA beats userB
    const match1 = await createMatch(club1.id, actorA, {
      type: "SINGLES",
      teamAUserIds: [userA.id],
      teamBUserIds: [userB.id]
    });
    await completeMatch(club1.id, match1.id, actorA, {
      sets: [
        { a: 21, b: 18 },
        { a: 21, b: 19 }
      ]
    });

    // Match in Club 2: userB beats userA
    const match2 = await createMatch(club2.id, actorA, {
      type: "SINGLES",
      teamAUserIds: [userA.id],
      teamBUserIds: [userB.id]
    });
    await completeMatch(club2.id, match2.id, actorA, {
      sets: [
        { a: 15, b: 21 },
        { a: 16, b: 21 }
      ]
    });

    // 1. Check member list in Club 1
    const club1Members = await listMembers(club1.id);
    const memberA = club1Members.find((m) => m.userId === userA.id);
    const memberB = club1Members.find((m) => m.userId === userB.id);

    expect(memberA).toBeDefined();
    expect(memberB).toBeDefined();

    // In Club 1:
    // userA: won in club1, lost in club2 -> clubWins >= 1, clubLosses >= 0, lifetimeWins >= 1, lifetimeLosses >= 1
    expect(memberA?.clubWins).toBeGreaterThanOrEqual(1);
    expect(memberA?.showStats).toBe(true);

    // userB: lost in club1, won in club2 -> in club1, clubWins is 0 (or baseline), clubLosses >= 1, lifetimeWins >= 1
    expect(memberB?.clubLosses).toBeGreaterThanOrEqual(1);
    expect(memberB?.lifetimeWins).toBeGreaterThanOrEqual(1);
    expect(memberB?.showStats).toBe(true);

    // 2. Turn off stats in settings for userB
    await updateProfile(userB.id, { showMatchStats: false });

    const club1MembersAfterPrivacy = await listMembers(club1.id);
    const memberBPrivate = club1MembersAfterPrivacy.find((m) => m.userId === userB.id);

    expect(memberBPrivate?.showStats).toBe(false);
    expect(memberBPrivate?.clubWins).toBeNull();
    expect(memberBPrivate?.clubLosses).toBeNull();
    expect(memberBPrivate?.lifetimeWins).toBeNull();
    expect(memberBPrivate?.lifetimeLosses).toBeNull();

    // Reset userB back to true
    await updateProfile(userB.id, { showMatchStats: true });
  });
});

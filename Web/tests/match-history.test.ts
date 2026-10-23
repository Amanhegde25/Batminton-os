import { describe, expect, it } from "vitest";
import { users, clubMembers } from "../src/server/db";
import { createClub } from "../src/server/services/clubs";
import { addMember } from "../src/server/services/members";
import { createMatch, completeMatch, listUserMatchHistory } from "../src/server/services/matches";

describe("Cross-Club Player Match History", () => {
  it("fetches match history across multiple clubs with search by opponent and club filtering", async () => {
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

    // Create Club 1
    const club1 = await createClub(actorA, {
      name: `CrossClub Alpha ${Date.now()}`,
      city: "Bengaluru"
    });

    // Create Club 2
    const club2 = await createClub(actorA, {
      name: `CrossClub Beta ${Date.now()}`,
      city: "Mysuru"
    });

    // Add userB as member in both clubs
    const m1 = await addMember(club1.id, actorA, {
      email: userB.email || `b_${Date.now()}@test.club`,
      name: userB.name,
      role: "PLAYER"
    });
    await clubMembers().updateOne({ id: m1.id }, { $set: { userId: userB.id } });

    const m2 = await addMember(club2.id, actorA, {
      email: userB.email || `b_${Date.now()}@test.club`,
      name: userB.name,
      role: "PLAYER"
    });
    await clubMembers().updateOne({ id: m2.id }, { $set: { userId: userB.id } });

    // Play Match 1 in Club 1 (userA wins)
    const match1 = await createMatch(club1.id, actorA, {
      type: "SINGLES",
      teamAUserIds: [userA.id],
      teamBUserIds: [userB.id]
    });
    await completeMatch(club1.id, match1.id, actorA, {
      sets: [
        { a: 21, b: 15 },
        { a: 21, b: 17 }
      ]
    });

    // Play Match 2 in Club 2 (userB wins)
    const match2 = await createMatch(club2.id, actorA, {
      type: "SINGLES",
      teamAUserIds: [userA.id],
      teamBUserIds: [userB.id]
    });
    await completeMatch(club2.id, match2.id, actorA, {
      sets: [
        { a: 16, b: 21 },
        { a: 18, b: 21 }
      ]
    });

    // 1. Fetch userA's history across all clubs
    const historyAll = await listUserMatchHistory(userA.id);
    expect(historyAll.items.length).toBeGreaterThanOrEqual(2);
    const itemIds = historyAll.items.map((i) => i.id);
    expect(itemIds).toContain(match1.id);
    expect(itemIds).toContain(match2.id);

    // Verify clubs list in response
    const returnedClubIds = historyAll.clubs.map((c) => c.id);
    expect(returnedClubIds).toContain(club1.id);
    expect(returnedClubIds).toContain(club2.id);

    // 2. Filter by Club 1
    const historyClub1 = await listUserMatchHistory(userA.id, { clubId: club1.id });
    expect(historyClub1.items.some((i) => i.id === match1.id)).toBe(true);
    expect(historyClub1.items.some((i) => i.id === match2.id)).toBe(false);

    // 3. Filter by Outcome
    const historyWins = await listUserMatchHistory(userA.id, { outcome: "WON" });
    const match1Item = historyWins.items.find((i) => i.id === match1.id);
    expect(match1Item).toBeDefined();
    expect(match1Item?.won).toBe(true);
    expect(historyWins.items.some((i) => i.id === match2.id)).toBe(false);

    const historyLosses = await listUserMatchHistory(userA.id, { outcome: "LOST" });
    const match2Item = historyLosses.items.find((i) => i.id === match2.id);
    expect(match2Item).toBeDefined();
    expect(match2Item?.won).toBe(false);

    // 4. Search by Opponent Name
    const opponentSearch = await listUserMatchHistory(userA.id, { q: userB.name.slice(0, 3) });
    expect(opponentSearch.items.some((i) => i.id === match1.id)).toBe(true);

    // 5. Search by Club Name
    const clubSearch = await listUserMatchHistory(userA.id, { q: "CrossClub Alpha" });
    expect(clubSearch.items.some((i) => i.id === match1.id)).toBe(true);
    expect(clubSearch.items.some((i) => i.id === match2.id)).toBe(false);
  });
});

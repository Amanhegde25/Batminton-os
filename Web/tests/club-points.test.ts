import { describe, expect, it } from "vitest";
import { users, clubMembers, attendanceRecords } from "../src/server/db";
import { createClub, updateClub } from "../src/server/services/clubs";
import { addMember, listMembers } from "../src/server/services/members";
import { createMatch, completeMatch } from "../src/server/services/matches";
import { getLeaderboard } from "../src/server/services/leaderboards";
import { cuid } from "../src/lib/id";
import { dayKey } from "../src/lib/date";

describe("Club Points and Club Ranking System", () => {
  it("calculates ranking points with default values (+1 win, -1 loss, +1 attendance, 0 absence)", async () => {
    const userA = {
      id: cuid(),
      email: `ptsa_${Date.now()}@test.club`,
      name: "Points Player A",
      role: "PLAYER",
      tokenVersion: 1,
      showMatchStats: true
    };
    const userB = {
      id: cuid(),
      email: `ptsb_${Date.now()}@test.club`,
      name: "Points Player B",
      role: "PLAYER",
      tokenVersion: 1,
      showMatchStats: true
    };
    await users().insertOne(userA);
    await users().insertOne(userB);

    const actorA = {
      id: userA.id,
      email: userA.email,
      name: userA.name,
      role: "PLAYER",
      tokenVersion: 1
    };

    // 1. Create test club
    const club = await createClub(actorA, {
      name: `Points Club ${Date.now()}`,
      city: "Bengaluru"
    });

    // 2. Add userB as player
    const mB = await addMember(club.id, actorA, {
      email: userB.email || `player_pts_${Date.now()}@test.club`,
      name: userB.name,
      role: "PLAYER"
    });
    await clubMembers().updateOne({ id: mB.id }, { $set: { userId: userB.id } });

    // 3. UserA wins a match against UserB
    const match = await createMatch(club.id, actorA, {
      type: "SINGLES",
      teamAUserIds: [userA.id],
      teamBUserIds: [userB.id]
    });
    await completeMatch(club.id, match.id, actorA, {
      sets: [
        { a: 21, b: 15 },
        { a: 21, b: 18 }
      ]
    });

    // 4. Mark attendance: UserA present, UserB absent
    const today = dayKey();
    await attendanceRecords().insertOne({
      id: cuid(),
      clubId: club.id,
      userId: userA.id,
      day: today,
      status: "PRESENT",
      method: "MANUAL",
      lat: null,
      lng: null,
      note: null,
      markedById: userA.id,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await attendanceRecords().insertOne({
      id: cuid(),
      clubId: club.id,
      userId: userB.id,
      day: today,
      status: "ABSENT",
      method: "AUTO",
      lat: null,
      lng: null,
      note: null,
      markedById: userA.id,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // 5. Query leaderboard for CLUB_POINTS with default settings
    // Default formula: (wins * 1) + (losses * -1) + (present * 1) + (absent * 0)
    // userA: 1 win (+1), 0 losses, 1 present (+1) -> 2 points
    // userB: 0 wins, 1 loss (-1), 1 absent (0) -> -1 point
    const rankingDefault = await getLeaderboard(club.id, "CLUB_POINTS", "ALL_TIME");
    expect(rankingDefault.length).toBeGreaterThanOrEqual(2);

    const rankA = rankingDefault.find((r) => r.userId === userA.id);
    const rankB = rankingDefault.find((r) => r.userId === userB.id);

    expect(rankA).toBeDefined();
    expect(rankB).toBeDefined();
    expect(rankA?.value).toBe(2);
    expect(rankB?.value).toBe(-1);
    expect(rankingDefault[0].userId).toBe(userA.id); // userA ranked #1

    // Also check member list reflects clubPoints
    const membersDefault = await listMembers(club.id);
    const memberA = membersDefault.find((m) => m.userId === userA.id);
    const memberB = membersDefault.find((m) => m.userId === userB.id);
    expect(memberA?.clubPoints).toBe(2);
    expect(memberB?.clubPoints).toBe(-1);

    // 6. Club admin updates custom points config:
    // Win = 3, Loss = -2, Attendance = 2, Absence = -1
    await updateClub(club.id, actorA, {
      settings: {
        pointsConfig: {
          winPoints: 3,
          lossPoints: -2,
          attendancePoints: 2,
          absencePoints: -1
        }
      }
    });

    // Custom formula:
    // userA: 1 win (* 3 = 3) + 1 present (* 2 = 2) = 5 points
    // userB: 1 loss (* -2 = -2) + 1 absent (* -1 = -1) = -3 points
    const rankingCustom = await getLeaderboard(club.id, "CLUB_POINTS", "ALL_TIME");
    const customRankA = rankingCustom.find((r) => r.userId === userA.id);
    const customRankB = rankingCustom.find((r) => r.userId === userB.id);

    expect(customRankA?.value).toBe(5);
    expect(customRankB?.value).toBe(-3);

    const membersCustom = await listMembers(club.id);
    const customMemberA = membersCustom.find((m) => m.userId === userA.id);
    const customMemberB = membersCustom.find((m) => m.userId === userB.id);
    expect(customMemberA?.clubPoints).toBe(5);
    expect(customMemberB?.clubPoints).toBe(-3);
  });
});

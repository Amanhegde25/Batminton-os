import { describe, expect, it } from "vitest";
import { users, clubs, clubMembers } from "../src/server/db";
import { createClub, updateClub } from "../src/server/services/clubs";
import { changeRole, addMember } from "../src/server/services/members";

describe("Club RBAC: Super Admin, Owner, and Admin Privileges", () => {
  it("allows super admin to provision a club and assign initial owner", async () => {
    const allUsers = await users().find().limit(3).toArray();
    expect(allUsers.length).toBeGreaterThanOrEqual(2);

    const superAdminUser = {
      id: (allUsers[0] as any).id,
      email: (allUsers[0] as any).email,
      name: (allUsers[0] as any).name,
      role: "SUPER_ADMIN",
      tokenVersion: 1
    };

    const targetOwner = allUsers[1] as any;

    const club = await createClub(superAdminUser, {
      name: `Super Admin Club ${Date.now()}`,
      city: "Bengaluru",
      description: "Provisioned by Super Admin",
      ownerId: targetOwner.id
    });

    expect(club.id).toBeDefined();
    expect(club.ownerId).toBe(targetOwner.id);

    // Verify owner membership was created for targetOwner
    const ownerMembership = await clubMembers().findOne({
      clubId: club.id,
      userId: targetOwner.id,
      role: "OWNER"
    });
    expect(ownerMembership).toBeDefined();
    expect(ownerMembership?.status).toBe("ACTIVE");
  });

  it("enforces role change privileges: owner can assign any role; admin cannot assign or alter owner/admin", async () => {
    const allUsers = await users().find().limit(4).toArray();
    const ownerUser = allUsers[0] as any;
    const adminUser = allUsers[1] as any;
    const regularMember = allUsers[2] as any;

    const club = await createClub(
      {
        id: ownerUser.id,
        email: ownerUser.email,
        name: ownerUser.name,
        role: "PLAYER",
        tokenVersion: 1
      },
      {
        name: `Privilege Test Club ${Date.now()}`,
        city: "Bengaluru"
      }
    );

    // Add admin and regular member to the club
    const adminMem = await addMember(club.id, ownerUser, {
      email: adminUser.email || `admin_${Date.now()}@test.club`,
      name: adminUser.name,
      role: "ADMIN"
    });
    // Link to actual user ID
    await clubMembers().updateOne({ id: adminMem.id }, { $set: { userId: adminUser.id } });

    const playerMem = await addMember(club.id, ownerUser, {
      email: regularMember.email || `player_${Date.now()}@test.club`,
      name: regularMember.name,
      role: "PLAYER"
    });
    await clubMembers().updateOne({ id: playerMem.id }, { $set: { userId: regularMember.id } });

    const ownerActor = {
      id: ownerUser.id,
      email: ownerUser.email,
      name: ownerUser.name,
      role: "PLAYER",
      tokenVersion: 1
    };

    const adminActor = {
      id: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      role: "PLAYER",
      tokenVersion: 1
    };

    // 1. Club Owner has the right to change someone to ADMIN or PLAYER or any other role
    const promotedToAdmin = await changeRole(club.id, ownerActor, playerMem.id, "ADMIN");
    expect(promotedToAdmin?.role).toBe("ADMIN");

    const demotedToPlayer = await changeRole(club.id, ownerActor, playerMem.id, "PLAYER");
    expect(demotedToPlayer?.role).toBe("PLAYER");

    // 2. Club Admin can change member between PLAYER and COACH
    const promotedToCoachByAdmin = await changeRole(club.id, adminActor, playerMem.id, "COACH");
    expect(promotedToCoachByAdmin?.role).toBe("COACH");

    const demotedBackToPlayerByAdmin = await changeRole(club.id, adminActor, playerMem.id, "PLAYER");
    expect(demotedBackToPlayerByAdmin?.role).toBe("PLAYER");

    // 3. Club Admin CANNOT assign ADMIN or OWNER roles -> throws forbidden
    await expect(
      changeRole(club.id, adminActor, playerMem.id, "ADMIN")
    ).rejects.toThrow("Only the club owner can assign OWNER or ADMIN roles");

    await expect(
      changeRole(club.id, adminActor, playerMem.id, "OWNER")
    ).rejects.toThrow("Only the club owner can assign OWNER or ADMIN roles");

    // 4. Club Admin CANNOT modify roles of existing ADMINs or OWNERs -> throws forbidden
    await expect(
      changeRole(club.id, adminActor, adminMem.id, "PLAYER")
    ).rejects.toThrow("Only the club owner can change roles of owners or admins");

    // 5. Club Owner and Admin can both update club description and details
    const updatedByAdmin = await updateClub(club.id, adminActor, {
      description: "Updated by Club Admin",
      city: "Bengaluru East",
      settings: {
        sport: "BADMINTON",
        openingTime: "05:30",
        closingTime: "23:00",
        scheduleNotes: "Open 5:30 AM – 11:00 PM daily",
        attendance: {
          graceMinutes: 20,
          selfCheckIn: true
        },
        membership: {
          monthlyFee: 150000
        }
      }
    });
    expect(updatedByAdmin.description).toBe("Updated by Club Admin");
    const parsedAdminSettings = typeof updatedByAdmin.settings === "string"
      ? JSON.parse(updatedByAdmin.settings)
      : updatedByAdmin.settings;
    expect(parsedAdminSettings.openingTime).toBe("05:30");
    expect(parsedAdminSettings.closingTime).toBe("23:00");
    expect(parsedAdminSettings.scheduleNotes).toBe("Open 5:30 AM – 11:00 PM daily");
    expect(parsedAdminSettings.attendance.graceMinutes).toBe(20);
    expect(parsedAdminSettings.membership.monthlyFee).toBe(150000);

    const updatedByOwner = await updateClub(club.id, ownerActor, {
      description: "Updated by Club Owner",
      settings: {
        openingTime: "06:00",
        closingTime: "22:30",
        scheduleNotes: "Standard Hours: 6 AM – 10:30 PM"
      }
    });
    expect(updatedByOwner.description).toBe("Updated by Club Owner");
    const parsedOwnerSettings = typeof updatedByOwner.settings === "string"
      ? JSON.parse(updatedByOwner.settings)
      : updatedByOwner.settings;
    expect(parsedOwnerSettings.openingTime).toBe("06:00");
    expect(parsedOwnerSettings.closingTime).toBe("22:30");
    expect(parsedOwnerSettings.scheduleNotes).toBe("Standard Hours: 6 AM – 10:30 PM");
    // Verify previous settings like graceMinutes were preserved by mergeSettings
    expect(parsedOwnerSettings.attendance.graceMinutes).toBe(20);
  });
});

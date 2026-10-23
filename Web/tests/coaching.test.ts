import { describe, expect, it } from "vitest";
import { users, clubs, clubMembers } from "../src/server/db";
import { createClub } from "../src/server/services/clubs";
import { addMember } from "../src/server/services/members";
import {
  createCoach,
  updateCoach,
  deleteCoach,
  listCoaches,
  bookCoachingSession,
  listCoachingBookings,
  cancelCoachingBooking,
  updateBookingStatus
} from "../src/server/services/coaching";

describe("Coaching System: Coach Management and Session Bookings", () => {
  it("allows club admin to create, update, and manage coaches with days and timings", async () => {
    const allUsers = await users().find().limit(3).toArray();
    expect(allUsers.length).toBeGreaterThanOrEqual(2);

    const ownerUser = allUsers[0] as any;
    const playerUser = allUsers[1] as any;

    const club = await createClub(
      {
        id: ownerUser.id,
        email: ownerUser.email,
        name: ownerUser.name,
        role: "PLAYER",
        tokenVersion: 1
      },
      {
        name: `Coaching Test Club ${Date.now()}`,
        city: "Bengaluru"
      }
    );

    const ownerActor = {
      id: ownerUser.id,
      email: ownerUser.email,
      name: ownerUser.name,
      role: "PLAYER",
      tokenVersion: 1
    };

    const playerActor = {
      id: playerUser.id,
      email: playerUser.email,
      name: playerUser.name,
      role: "PLAYER",
      tokenVersion: 1
    };

    // Add player to the club
    const playerMember = await addMember(club.id, ownerActor, {
      email: playerUser.email || `player_${Date.now()}@test.club`,
      name: playerUser.name,
      role: "PLAYER"
    });
    await clubMembers().updateOne({ id: playerMember.id }, { $set: { userId: playerUser.id } });

    // 1. Regular player CANNOT create a coach -> throws forbidden
    await expect(
      createCoach(club.id, playerActor, {
        name: "Coach Sneha",
        hourlyFee: 60000
      })
    ).rejects.toThrow();

    // 2. Club admin/owner creates a coach with 3 skill levels & custom pricing
    const coach = await createCoach(club.id, ownerActor, {
      name: "Coach Pullela",
      title: "Senior Elite Coach",
      bio: "Focuses on explosive smash power and defensive recovery",
      pricing: {
        BEGINNER: 40000,     // ₹400/hr
        INTERMEDIATE: 65000, // ₹650/hr
        ADVANCED: 90000      // ₹900/hr
      },
      levels: ["BEGINNER", "INTERMEDIATE", "ADVANCED"],
      availableDays: ["MONDAY", "WEDNESDAY", "FRIDAY", "SATURDAY"],
      availableTimeSlots: ["06:00 - 07:00", "07:00 - 08:00", "18:00 - 19:00"]
    });

    expect(coach.id).toBeDefined();
    expect(coach.name).toBe("Coach Pullela");
    expect(coach.pricing.BEGINNER).toBe(40000);
    expect(coach.pricing.INTERMEDIATE).toBe(65000);
    expect(coach.pricing.ADVANCED).toBe(90000);
    expect(coach.levels).toEqual(["BEGINNER", "INTERMEDIATE", "ADVANCED"]);
    expect(coach.availableDays).toContain("MONDAY");
    expect(coach.availableTimeSlots).toContain("06:00 - 07:00");
    expect(coach.active).toBe(true);

    // Verify coach appears in list
    const coaches = await listCoaches(club.id, true);
    expect(coaches.some((c) => c.id === coach.id)).toBe(true);

    // 3. Update coach details and level pricing
    const updated = await updateCoach(club.id, coach.id, ownerActor, {
      pricing: {
        BEGINNER: 45000,
        INTERMEDIATE: 70000,
        ADVANCED: 95000
      },
      title: "Chief National Mentor"
    });
    expect(updated.pricing.BEGINNER).toBe(45000);
    expect(updated.pricing.INTERMEDIATE).toBe(70000);
    expect(updated.pricing.ADVANCED).toBe(95000);
    expect(updated.title).toBe("Chief National Mentor");
  });

  it("allows users to book coaching sessions with selected level and verifies level-specific pricing", async () => {
    const allUsers = await users().find().limit(3).toArray();
    const ownerUser = allUsers[0] as any;
    const playerUser = allUsers[1] as any;

    const club = await createClub(
      {
        id: ownerUser.id,
        email: ownerUser.email,
        name: ownerUser.name,
        role: "PLAYER",
        tokenVersion: 1
      },
      {
        name: `Booking Test Arena ${Date.now()}`,
        city: "Bengaluru"
      }
    );

    const ownerActor = {
      id: ownerUser.id,
      email: ownerUser.email,
      name: ownerUser.name,
      role: "PLAYER",
      tokenVersion: 1
    };

    const playerActor = {
      id: playerUser.id,
      email: playerUser.email,
      name: playerUser.name,
      role: "PLAYER",
      tokenVersion: 1
    };

    // Add player to the club
    const playerMember = await addMember(club.id, ownerActor, {
      email: playerUser.email || `player_${Date.now()}@test.club`,
      name: playerUser.name,
      role: "PLAYER"
    });
    await clubMembers().updateOne({ id: playerMember.id }, { $set: { userId: playerUser.id } });

    // Coach offers BEGINNER and INTERMEDIATE with distinct costs set by club admin
    const coach = await createCoach(club.id, ownerActor, {
      name: "Coach Gopichand",
      pricing: {
        BEGINNER: 50000,     // ₹500
        INTERMEDIATE: 80000, // ₹800
        ADVANCED: 120000     // ₹1200
      },
      levels: ["BEGINNER", "INTERMEDIATE"],
      availableDays: ["SATURDAY", "SUNDAY"],
      availableTimeSlots: ["08:00 - 09:00", "09:00 - 10:00"]
    });

    // Pick upcoming Saturday date
    const d = new Date();
    d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
    const saturdayStr = d.toISOString().split("T")[0];

    // Next Tuesday (not an available day for this coach)
    const tuesDate = new Date();
    tuesDate.setDate(tuesDate.getDate() + ((2 - tuesDate.getDay() + 7) % 7 || 7));
    const tuesdayStr = tuesDate.toISOString().split("T")[0];

    // 1. Attempt to book on an unavailable day -> should fail
    await expect(
      bookCoachingSession(club.id, playerActor, {
        coachId: coach.id,
        sessionDate: tuesdayStr,
        timeSlot: "08:00 - 09:00",
        level: "BEGINNER"
      })
    ).rejects.toThrow("not available on TUESDAY");

    // 2. Attempt to book for a level NOT offered by coach -> should fail
    await expect(
      bookCoachingSession(club.id, playerActor, {
        coachId: coach.id,
        sessionDate: saturdayStr,
        timeSlot: "08:00 - 09:00",
        level: "ADVANCED"
      })
    ).rejects.toThrow("does not offer coaching for Advanced level");

    // 3. Book valid INTERMEDIATE session on Saturday -> fee must equal intermediate cost (₹800 = 80000 paise)
    const booking1 = await bookCoachingSession(club.id, playerActor, {
      coachId: coach.id,
      sessionDate: saturdayStr,
      timeSlot: "08:00 - 09:00",
      level: "INTERMEDIATE",
      notes: "Tactical positioning and jump smashes"
    });

    expect(booking1.id).toBeDefined();
    expect(booking1.status).toBe("CONFIRMED");
    expect(booking1.sessionDate).toBe(saturdayStr);
    expect(booking1.timeSlot).toBe("08:00 - 09:00");
    expect(booking1.level).toBe("INTERMEDIATE");
    expect(booking1.fee).toBe(80000);
    expect(booking1.coachName).toBe("Coach Gopichand");

    // 4. Attempting double-booking on the exact same date & slot -> throws conflict
    await expect(
      bookCoachingSession(club.id, playerActor, {
        coachId: coach.id,
        sessionDate: saturdayStr,
        timeSlot: "08:00 - 09:00",
        level: "BEGINNER"
      })
    ).rejects.toThrow("already booked");

    // 5. List bookings & verify level is returned
    const bookings = await listCoachingBookings(club.id, playerActor, { myOnly: true });
    expect(bookings.some((b) => b.id === booking1.id && b.level === "INTERMEDIATE")).toBe(true);

    // 6. Staff updates booking status to COMPLETED
    const completed = await updateBookingStatus(club.id, booking1.id, ownerActor, "COMPLETED");
    expect(completed.status).toBe("COMPLETED");

    // 7. Book another session for BEGINNER -> fee must equal beginner cost (₹500 = 50000 paise)
    const booking2 = await bookCoachingSession(club.id, playerActor, {
      coachId: coach.id,
      sessionDate: saturdayStr,
      timeSlot: "09:00 - 10:00",
      level: "BEGINNER"
    });
    expect(booking2.level).toBe("BEGINNER");
    expect(booking2.fee).toBe(50000);

    const cancelled = await cancelCoachingBooking(club.id, booking2.id, playerActor, "Personal schedule change");
    expect(cancelled.status).toBe("CANCELLED");
  });
});

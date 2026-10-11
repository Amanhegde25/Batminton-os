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

    // 2. Club admin/owner creates a coach
    const coach = await createCoach(club.id, ownerActor, {
      name: "Coach Pullela",
      title: "Senior Elite Coach",
      bio: "Focuses on explosive smash power and defensive recovery",
      hourlyFee: 75000, // ₹750/hr
      availableDays: ["MONDAY", "WEDNESDAY", "FRIDAY", "SATURDAY"],
      availableTimeSlots: ["06:00 - 07:00", "07:00 - 08:00", "18:00 - 19:00"]
    });

    expect(coach.id).toBeDefined();
    expect(coach.name).toBe("Coach Pullela");
    expect(coach.availableDays).toContain("MONDAY");
    expect(coach.availableTimeSlots).toContain("06:00 - 07:00");
    expect(coach.active).toBe(true);

    // Verify coach appears in list
    const coaches = await listCoaches(club.id, true);
    expect(coaches.some((c) => c.id === coach.id)).toBe(true);

    // 3. Update coach details
    const updated = await updateCoach(club.id, coach.id, ownerActor, {
      hourlyFee: 80000,
      title: "Chief National Mentor"
    });
    expect(updated.hourlyFee).toBe(80000);
    expect(updated.title).toBe("Chief National Mentor");
  });

  it("allows users to book coaching sessions on valid days and prevents double booking", async () => {
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

    // Coach available only on Saturday and Sunday
    const coach = await createCoach(club.id, ownerActor, {
      name: "Coach Gopichand",
      hourlyFee: 100000,
      availableDays: ["SATURDAY", "SUNDAY"],
      availableTimeSlots: ["08:00 - 09:00", "09:00 - 10:00"]
    });

    // Pick upcoming Saturday date
    const d = new Date();
    // Next Saturday
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
        timeSlot: "08:00 - 09:00"
      })
    ).rejects.toThrow("not available on TUESDAY");

    // 2. Book valid session on Saturday
    const booking1 = await bookCoachingSession(club.id, playerActor, {
      coachId: coach.id,
      sessionDate: saturdayStr,
      timeSlot: "08:00 - 09:00",
      notes: "Tactical positioning and jump smashes"
    });

    expect(booking1.id).toBeDefined();
    expect(booking1.status).toBe("CONFIRMED");
    expect(booking1.sessionDate).toBe(saturdayStr);
    expect(booking1.timeSlot).toBe("08:00 - 09:00");
    expect(booking1.coachName).toBe("Coach Gopichand");

    // 3. Attempting double-booking on the exact same date & slot -> throws conflict
    await expect(
      bookCoachingSession(club.id, playerActor, {
        coachId: coach.id,
        sessionDate: saturdayStr,
        timeSlot: "08:00 - 09:00"
      })
    ).rejects.toThrow("already booked");

    // 4. List bookings
    const bookings = await listCoachingBookings(club.id, playerActor, { myOnly: true });
    expect(bookings.some((b) => b.id === booking1.id)).toBe(true);

    // 5. Staff updates booking status to COMPLETED
    const completed = await updateBookingStatus(club.id, booking1.id, ownerActor, "COMPLETED");
    expect(completed.status).toBe("COMPLETED");

    // 6. User can cancel their own booking (when booking another slot)
    const booking2 = await bookCoachingSession(club.id, playerActor, {
      coachId: coach.id,
      sessionDate: saturdayStr,
      timeSlot: "09:00 - 10:00"
    });
    const cancelled = await cancelCoachingBooking(club.id, booking2.id, playerActor, "Personal schedule change");
    expect(cancelled.status).toBe("CANCELLED");
  });
});

import { describe, expect, it } from "vitest";
import { listPublicClubs } from "../src/server/services/clubs";

describe("Nearby Clubs geospatial discovery", () => {
  it("calculates distance and sorts closest clubs first given GPS coordinates", async () => {
    const clubs = await listPublicClubs(undefined, undefined, {
      lat: 12.9716,
      lng: 77.5946
    });

    expect(Array.isArray(clubs)).toBe(true);
    expect(clubs.length).toBeGreaterThan(0);

    const topClub = clubs[0];
    expect(topClub.distanceKm).toBeDefined();
    expect(topClub.distanceKm).toBeLessThan(1);
    expect(typeof topClub.courtCount).toBe("number");
    expect(typeof topClub.memberCount).toBe("number");
  });

  it("prioritizes matching city when coordinates are omitted", async () => {
    const clubs = await listPublicClubs(undefined, undefined, {
      city: "Pune"
    });

    expect(clubs.length).toBeGreaterThan(0);
    expect(clubs[0].city).toBe("Pune");
  });
});

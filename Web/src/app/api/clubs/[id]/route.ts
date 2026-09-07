import { ApiError, handler, ok, parseBody } from "@/lib/api";
import { z } from "zod";
import { currentUser } from "@/server/auth/session";
import { getClubContext, isStaffOf, requireStaff, requireUser } from "@/server/rbac";
import { getClubForUser, updateClub } from "@/server/services/clubs";
import { featuresFor } from "@/lib/constants";

export const GET = handler(async (_req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id } = await params;
  await getClubContext(id, user);
  const club = await getClubForUser(id);
  return ok({
    id: club.id,
    name: club.name,
    slug: club.slug,
    description: club.description,
    city: club.city,
    address: club.address,
    logoUrl: club.logoUrl,
    ownerId: club.ownerId,
    owner: club.owner,
    subscriptionPlan: club.subscriptionPlan,
    settings: JSON.parse(club.settings || "{}"),
    features: featuresFor(club.subscriptionPlan),
    counts: {
      members: club._count.members,
      courts: club._count.courts,
      matches: club._count.matches
    }
  });
});

const patchSchema = z.object({
  name: z.string().min(3).max(80).optional(),
  description: z.string().max(500).optional(),
  city: z.string().max(80).optional(),
  address: z.string().max(200).optional(),
  logoUrl: z.string().max(500).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  settings: z
    .object({
      attendance: z
        .object({
          startMinutes: z.number().min(0).max(1439).optional(),
          graceMinutes: z.number().min(0).max(120).optional(),
          gpsRequired: z.boolean().optional(),
          gpsRadiusMeters: z.number().min(20).max(5000).optional(),
          selfCheckIn: z.boolean().optional(),
          autoAbsentPenalty: z.boolean().optional(),
          minAttendancePct: z.number().min(0).max(100).optional()
        })
        .optional(),
      booking: z.object({ cancellationWindowMinutes: z.number().min(0).max(1440).optional() }).optional(),
      membership: z.object({ monthlyFee: z.number().min(0).optional(), autoApprove: z.boolean().optional() }).optional()
    })
    .optional()
});

export const PATCH = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id } = await params;
  const staff = await isStaffOf(id, user);
  if (!staff && user.role !== "SUPER_ADMIN") throw ApiError.forbidden("Only club admins can update the club");
  if (staff) await requireStaff(id, user);
  const patch = await parseBody(req, patchSchema);
  return ok(await updateClub(id, user, patch));
});

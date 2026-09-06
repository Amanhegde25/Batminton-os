import { handler, ok, parseBody } from "@/lib/api";
import { z } from "zod";
import { currentUser } from "@/server/auth/session";
import { getClubContext, requireStaff, requireUser } from "@/server/rbac";
import { createCourt, listCourts, updateCourt } from "@/server/services/courts";

export const GET = handler(async (_req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id } = await params;
  await getClubContext(id, user);
  return ok(await listCourts(id));
});

const createSchema = z.object({
  name: z.string().min(1).max(60),
  number: z.number().int().min(1).max(200).optional(),
  type: z.enum(["SYNTHETIC", "WOODEN", "CEMENT", "OUTDOOR"]).optional(),
  openHour: z.number().int().min(0).max(23).optional(),
  closeHour: z.number().int().min(1).max(24).optional(),
  hourlyFee: z.number().int().min(0).optional()
});

export const POST = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id } = await params;
  await requireStaff(id, user);
  const input = await parseBody(req, createSchema);
  return ok(await createCourt(id, input), { status: 201 });
});

const patchSchema = z.object({
  courtId: z.string(),
  name: z.string().min(1).max(60).optional(),
  type: z.enum(["SYNTHETIC", "WOODEN", "CEMENT", "OUTDOOR"]).optional(),
  status: z.enum(["AVAILABLE", "OCCUPIED", "MAINTENANCE", "DISABLED"]).optional(),
  openHour: z.number().int().min(0).max(23).optional(),
  closeHour: z.number().int().min(1).max(24).optional(),
  hourlyFee: z.number().int().min(0).optional()
});

export const PATCH = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id } = await params;
  await requireStaff(id, user);
  const input = await parseBody(req, patchSchema);
  const { courtId, ...patch } = input;
  return ok(await updateCourt(id, courtId, patch));
});

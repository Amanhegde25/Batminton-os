import { ApiError, handler, ok } from "@/lib/api";
import { currentUser } from "@/server/auth/session";
import { assertFeature, getClubContext, isStaffOf, requireUser } from "@/server/rbac";
import { FEATURES } from "@/lib/constants";
import { listVideos, uploadVideo } from "@/server/services/ai";

export const GET = handler(async (_req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id } = await params;
  const ctx = await getClubContext(id, user);
  await assertFeature(ctx.club, FEATURES.VIDEO_ANALYSIS);
  const staff = ["OWNER", "ADMIN", "COACH"].includes(ctx.membership?.role ?? "") || (await isStaffOf(id, user));
  const rows = await listVideos(id, user, staff);
  return ok(
    rows.map((v) => ({
      id: v.id,
      userId: v.userId,
      fileName: v.originalName,
      status: v.status,
      error: v.error,
      createdAt: v.createdAt
    }))
  );
});

export const POST = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id } = await params;
  const ctx = await getClubContext(id, user);
  await assertFeature(ctx.club, FEATURES.VIDEO_ANALYSIS);
  const form = await req.formData().catch(() => null);
  if (!form) throw ApiError.badRequest("multipart/form-data with a file field is required");
  const file = form.get("file");
  if (!(file instanceof File)) throw ApiError.badRequest("file field is required");
  return ok(
    await uploadVideo(id, user, {
      buffer: Buffer.from(await file.arrayBuffer()),
      originalname: file.name,
      mimetype: file.type
    })
  );
});

import { ApiError, handler, ok } from "@/lib/api";
import { currentUser } from "@/server/auth/session";
import { requireUser } from "@/server/rbac";
import { getStorage, MIME_BY_EXT } from "@/server/providers/storage";

const ALLOWED_IMAGE = ["image/png", "image/jpeg", "image/webp"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const POST = handler(async (req) => {
  await requireUser(await currentUser());
  const form = await req.formData().catch(() => null);
  if (!form) throw ApiError.badRequest("multipart/form-data expected");
  const file = form.get("file");
  if (!(file instanceof File)) throw ApiError.badRequest("file field is required");
  if (!ALLOWED_IMAGE.includes(file.type)) throw ApiError.badRequest("Only PNG, JPEG or WebP images are allowed");
  if (file.size > MAX_IMAGE_BYTES) throw ApiError.badRequest("Image exceeds the 5MB limit");
  const ext = file.name.includes(".") ? `.${file.name.split(".").pop()!.toLowerCase()}` : "";
  const key = `images/${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const stored = await getStorage().put(key, buffer, file.type);
  return ok(stored);
});

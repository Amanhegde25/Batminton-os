import { handler, ok } from "@/lib/api";
import { currentUser } from "@/server/auth/session";
import { assertFeature, getClubContext, requireUser } from "@/server/rbac";
import { FEATURES } from "@/lib/constants";
import { getVideo } from "@/server/services/ai";

export const GET = handler(async (_req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id, videoId } = (await params) as { id: string; videoId: string };
  const ctx = await getClubContext(id, user);
  await assertFeature(ctx.club, FEATURES.VIDEO_ANALYSIS);
  const v = await getVideo(id, videoId);
  return ok({
    id: v.id,
    status: v.status,
    error: v.error,
    analysis: v.result as Record<string, unknown> | null
  });
});

import { ApiError, handler, ok, parseBody } from "@/lib/api";
import { z } from "zod";
import { currentUser } from "@/server/auth/session";
import { getClubContext, requireManagerOrCoach, requireStaff, requireUser } from "@/server/rbac";
import { LEADERBOARD_CATEGORIES, type LeaderboardCategory } from "@/server/services/leaderboards";
import { getLeaderboard } from "@/server/services/leaderboards";
import type { PeriodKey } from "@/lib/date";

const querySchema = z.object({
  category: z.string().default("BEST_PLAYER"),
  period: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY", "ALL_TIME"]).default("MONTHLY")
});

export const GET = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id } = await params;
  await getClubContext(id, user);
  const q = parseQuerySafe(req);
  if (!LEADERBOARD_CATEGORIES.includes(q.category as LeaderboardCategory)) {
    throw ApiError.badRequest(`category must be one of ${LEADERBOARD_CATEGORIES.join(", ")}`);
  }
  void requireManagerOrCoach;
  void requireStaff;
  return ok(
    await getLeaderboard(id, q.category as LeaderboardCategory, q.period as PeriodKey)
  );
});

function parseQuerySafe(req: Request): z.infer<typeof querySchema> {
  try {
    return querySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  } catch {
    return { category: "BEST_PLAYER", period: "MONTHLY" };
  }
}

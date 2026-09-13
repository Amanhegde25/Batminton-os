import { handler, ok, parseBody } from "@/lib/api";
import { currentUser } from "@/server/auth/session";
import { requireUser } from "@/server/rbac";
import { postMessage } from "@/server/services/groups";
import { playGroupPosts, users } from "@/server/db";
import { z } from "zod";

export const GET = handler(async (req, { params }) => {
  await requireUser(await currentUser(req));
  const { id } = await params;
  const posts = await playGroupPosts()
    .find({ groupId: id })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();

  const userIds = Array.from(new Set(posts.map((p) => p.userId as string)));
  const userList = userIds.length > 0
    ? await users().find({ id: { $in: userIds } }, { projection: { id: 1, name: 1, photoUrl: 1 } }).toArray()
    : [];
  const userMap = new Map(userList.map((u) => [u.id as string, u]));

  const result = posts.map((p) => ({
    ...p,
    user: userMap.get(p.userId as string) || null
  }));

  return ok(result);
});

const postSchema = z.object({
  content: z.string().min(1).max(1000)
});

export const POST = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser(req));
  const { id } = await params;
  const input = await parseBody(req, postSchema);
  const post = await postMessage(id, user.id, input.content);
  return ok(post, { status: 201 });
});

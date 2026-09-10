import { handler, ok, parseBody } from "@/lib/api";
import { currentUser } from "@/server/auth/session";
import { requireUser } from "@/server/rbac";
import { postMessage } from "@/server/services/groups";
import { prisma } from "@/server/db";
import { z } from "zod";

export const GET = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser(req));
  const { id } = await params;
  const posts = await prisma.playGroupPost.findMany({
    where: { groupId: id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      user: { select: { id: true, name: true, photoUrl: true } }
    }
  });
  return ok(posts);
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

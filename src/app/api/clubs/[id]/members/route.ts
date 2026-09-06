import { handler, ok, parseBody } from "@/lib/api";
import { z } from "zod";
import { currentUser } from "@/server/auth/session";
import { requireManagerOrCoach, requireStaff, requireUser } from "@/server/rbac";
import { addMember, approveMembership, changeRole, listMembers } from "@/server/services/members";

export const GET = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id } = await params;
  await requireManagerOrCoach(id, user);
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  return ok(await listMembers(id, q || undefined, status || undefined));
});

const addSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(80).optional(),
  role: z.enum(["ADMIN", "COACH", "PLAYER"]).optional()
});

export const POST = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id } = await params;
  const url = new URL(req.url);
  const rawBody = await req.clone().json().catch(() => ({}));
  const action = url.searchParams.get("action") ?? rawBody.action;

  if (action === "approve" || action === "reject") {
    await requireStaff(id, user);
    const body = await parseBody(req, z.object({ memberId: z.string(), action: z.string().optional() }));
    let resolvedMemberId = body.memberId;
    // Fallback: if memberId is actually a userId, look up the pending membership
    const { prisma } = await import("@/server/db");
    const direct = await prisma.clubMember.findFirst({ where: { id: resolvedMemberId, clubId: id } });
    if (!direct) {
      const byUser = await prisma.clubMember.findFirst({ where: { userId: resolvedMemberId, clubId: id, status: "PENDING" } });
      if (byUser) resolvedMemberId = byUser.id;
    }
    return ok(await approveMembership(id, user, resolvedMemberId, action === "approve"));
  }

  const ctx = await requireManagerOrCoach(id, user);
  const input = await parseBody(req, addSchema);
  if ((input.role === "ADMIN") && !["OWNER", "ADMIN"].includes(ctx.membership?.role ?? "")) {
    return ok(await addMember(id, user, { ...input, role: "PLAYER" }));
  }
  return ok(await addMember(id, user, input));
});

const patchSchema = z
  .object({
    memberId: z.string().optional(),
    userId: z.string().optional(),
    role: z.enum(["OWNER", "ADMIN", "COACH", "PLAYER"])
  })
  .refine((d) => Boolean(d.memberId || d.userId), { message: "Either memberId or userId is required" });

export const PATCH = handler(async (req, { params }) => {
  const user = await requireUser(await currentUser());
  const { id } = await params;
  await requireManagerOrCoach(id, user);
  const input = await parseBody(req, patchSchema);
  let targetMemberId = input.memberId;
  if (!targetMemberId && input.userId) {
    const { prisma } = await import("@/server/db");
    const mem = await prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId: id, userId: input.userId } }
    });
    if (mem) targetMemberId = mem.id;
  }
  if (!targetMemberId) {
    const { ApiError } = await import("@/lib/api");
    throw ApiError.notFound("Member not found");
  }
  return ok(await changeRole(id, user, targetMemberId, input.role));
});

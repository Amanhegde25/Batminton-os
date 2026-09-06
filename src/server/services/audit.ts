import { prisma } from "@/server/db";
import { AUDIT_ACTIONS } from "@/lib/constants";

export interface AuditInput {
  clubId?: string | null;
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  previousValue?: unknown;
  newValue?: unknown;
}

export async function audit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        clubId: input.clubId ?? null,
        actorUserId: input.actorUserId ?? null,
        action: input.action ?? AUDIT_ACTIONS.CLUB_UPDATED,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        previousValue: input.previousValue !== undefined ? safeJson(input.previousValue) : null,
        newValue: input.newValue !== undefined ? safeJson(input.newValue) : null
      }
    });
  } catch (e) {
    console.error("[audit] failed", e);
  }
}

export async function listAudit(clubId: string, page = 1, pageSize = 50) {
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: { clubId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { actor: { select: { name: true, email: true } } }
    }),
    prisma.auditLog.count({ where: { clubId } })
  ]);
  return {
    items: items.map((i) => ({
      ...i,
      previousValue: tryParse(i.previousValue),
      newValue: tryParse(i.newValue)
    })),
    total,
    page,
    pageSize
  };
}

function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function tryParse(s: string | null): unknown {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

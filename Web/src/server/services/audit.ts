import { auditLogs } from "@/server/db";
import { AUDIT_ACTIONS } from "@/lib/constants";
import { cuid } from "@/lib/id";

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
    await auditLogs().insertOne({
      id: cuid(),
      clubId: input.clubId ?? null,
      actorUserId: input.actorUserId ?? null,
      action: input.action ?? AUDIT_ACTIONS.CLUB_UPDATED,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      previousValue: input.previousValue !== undefined ? safeJson(input.previousValue) : null,
      newValue: input.newValue !== undefined ? safeJson(input.newValue) : null,
      createdAt: new Date()
    });
  } catch (e) {
    console.error("[audit] failed", e);
  }
}

export async function listAudit(clubId: string, page = 1, pageSize = 50) {
  const skip = (page - 1) * pageSize;
  const pipeline = [
    { $match: { clubId } },
    { $sort: { createdAt: -1 as const } },
    { $skip: skip },
    { $limit: pageSize },
    {
      $lookup: {
        from: "users",
        let: { actorId: "$actorUserId" },
        pipeline: [
          { $match: { $expr: { $eq: ["$id", "$$actorId"] } } },
          { $project: { name: 1, email: 1, _id: 0 } }
        ],
        as: "actorArr"
      }
    },
    { $addFields: { actor: { $arrayElemAt: ["$actorArr", 0] } } },
    { $project: { actorArr: 0, _id: 0 } }
  ];
  const [items, total] = await Promise.all([
    auditLogs().aggregate(pipeline).toArray(),
    auditLogs().countDocuments({ clubId })
  ]);
  return {
    items: items.map((i) => ({
      ...i,
      previousValue: tryParse(i.previousValue as string | null),
      newValue: tryParse(i.newValue as string | null)
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

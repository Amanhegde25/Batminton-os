import { penaltyRules, penalties, walletTransactions, users } from "@/server/db";
import { ApiError } from "@/lib/api";
import { AUDIT_ACTIONS, type PenaltyEvent } from "@/lib/constants";
import { matchRule, penaltySummary, type RuleLite } from "@/lib/engines/penalty-engine";
import { audit } from "./audit";
import { notify } from "./notifications";
import { postTransaction } from "./wallets";
import { cuid } from "@/lib/id";

export async function listRules(clubId: string) {
  return penaltyRules().find({ clubId }).sort({ eventType: 1, label: 1 }).toArray();
}

export async function upsertRule(
  clubId: string,
  actor: { id: string },
  input: { eventType: PenaltyEvent; label: string; amount: number; enabled: boolean }
) {
  if (input.amount < 0) throw ApiError.badRequest("Amount cannot be negative");
  const existing = await penaltyRules().findOne({ clubId, eventType: input.eventType, label: input.label });
  let rule;
  if (existing) {
    rule = await penaltyRules().findOneAndUpdate(
      { id: existing.id },
      { $set: { amount: input.amount, enabled: input.enabled, updatedAt: new Date() } },
      { returnDocument: "after" }
    );
  } else {
    rule = {
      id: cuid(),
      clubId,
      eventType: input.eventType,
      label: input.label,
      amount: input.amount,
      enabled: input.enabled,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await penaltyRules().insertOne(rule);
  }
  await audit({
    clubId,
    actorUserId: actor.id,
    action: AUDIT_ACTIONS.RULE_UPSERTED,
    entityType: "PenaltyRule",
    entityId: (rule?.id ?? existing?.id) as string,
    previousValue: existing ? { amount: existing.amount, enabled: existing.enabled } : null,
    newValue: { eventType: input.eventType, label: input.label, amount: input.amount, enabled: input.enabled }
  });
  return rule;
}

export async function deleteRule(clubId: string, actor: { id: string }, ruleId: string) {
  const rule = await penaltyRules().findOne({ id: ruleId, clubId });
  if (!rule) throw ApiError.notFound("Rule not found");
  const updated = await penaltyRules().findOneAndUpdate(
    { id: ruleId },
    { $set: { enabled: false, updatedAt: new Date() } },
    { returnDocument: "after" }
  );
  await audit({
    clubId,
    actorUserId: actor.id,
    action: AUDIT_ACTIONS.RULE_DELETED,
    entityType: "PenaltyRule",
    entityId: ruleId,
    previousValue: { enabled: true, amount: rule.amount },
    newValue: { enabled: false }
  });
  return updated;
}

export interface IssueEventOptions {
  relatedType?: string | null;
  relatedId?: string | null;
  createdById?: string | null;
  notify?: boolean;
  reason?: string;
}

export async function issueFromEvent(
  _db: unknown,
  clubId: string,
  userId: string,
  eventType: PenaltyEvent,
  opts: IssueEventOptions = {}
) {
  const rules = await penaltyRules().find({ clubId }).toArray() as unknown as RuleLite[];
  const rule = matchRule(rules, eventType);
  if (!rule || rule.amount <= 0) return null;
  const txnType = `PENALTY_${eventType}`;
  const txn = await postTransaction(null, {
    clubId,
    userId,
    amount: -rule.amount,
    type: txnType,
    description: opts.reason || `Penalty: ${rule.label}`,
    createdById: opts.createdById ?? null,
    relatedType: opts.relatedType ?? null,
    relatedId: opts.relatedId ?? null
  });
  const penalty = {
    id: cuid(),
    clubId,
    ruleId: (rule as any).id ?? null,
    userId,
    eventType,
    amount: rule.amount,
    reason: opts.reason || rule.label,
    transactionId: txn.id,
    relatedType: opts.relatedType ?? null,
    relatedId: opts.relatedId ?? null,
    status: "ACTIVE",
    reversalTransactionId: null,
    createdById: opts.createdById ?? null,
    createdAt: new Date(),
    reversedAt: null
  };
  await penalties().insertOne(penalty);
  await walletTransactions().updateOne(
    { id: txn.id },
    { $set: { relatedType: "Penalty", relatedId: penalty.id } }
  );
  if (opts.notify !== false) {
    await notify({
      userId,
      clubId,
      type: "PENALTY_ADDED",
      title: `Penalty applied: ₹${rule.amount}`,
      body: opts.reason || rule.label
    });
  }
  return penalty;
}

export async function issueManual(
  clubId: string,
  actor: { id: string },
  input: { userId: string; eventType: PenaltyEvent; label?: string; amount?: number; reason?: string }
) {
  if (input.eventType === "CUSTOM" && !input.label) throw ApiError.badRequest("Custom penalties need a label");
  let amount = input.amount;
  let label = input.label ?? input.reason ?? input.eventType;
  let ruleId: string | null = null;
  if (!amount) {
    const filter: Record<string, unknown> = { clubId, eventType: input.eventType, enabled: true };
    if (input.label) filter.label = input.label;
    const rule = await penaltyRules().findOne(filter);
    if (!rule) throw ApiError.badRequest(`No enabled rule for ${input.eventType}. Provide an explicit amount.`);
    amount = rule.amount as number;
    label = rule.label as string;
    ruleId = rule.id as string;
  }

  const txn = await postTransaction(null, {
    clubId,
    userId: input.userId,
    amount: -amount!,
    type: `PENALTY_${input.eventType}`,
    description: input.reason || label,
    createdById: actor.id
  });
  const result = {
    id: cuid(),
    clubId,
    ruleId,
    userId: input.userId,
    eventType: input.eventType,
    amount: amount!,
    reason: input.reason || label,
    transactionId: txn.id,
    relatedType: null,
    relatedId: null,
    status: "ACTIVE",
    reversalTransactionId: null,
    createdById: actor.id,
    createdAt: new Date(),
    reversedAt: null
  };
  await penalties().insertOne(result);

  await audit({
    clubId,
    actorUserId: actor.id,
    action: AUDIT_ACTIONS.PENALTY_MANUAL,
    entityType: "Penalty",
    entityId: result.id,
    newValue: { userId: input.userId, amount, label }
  });
  await notify({
    userId: input.userId,
    clubId,
    type: "PENALTY_ADDED",
    title: `Penalty applied: ₹${amount}`,
    body: label
  });
  return result;
}

export async function reversePenalty(clubId: string, actor: { id: string }, penaltyId: string, reason?: string) {
  const penalty = await penalties().findOne({ id: penaltyId, clubId });
  if (!penalty) throw ApiError.notFound("Penalty not found");
  if (penalty.status === "REVERSED") throw ApiError.conflict("Penalty already reversed");
  if (!penalty.transactionId) throw ApiError.badRequest("Penalty has no linked transaction to reverse");

  const rev = await postTransaction(null, {
    clubId,
    userId: penalty.userId as string,
    amount: penalty.amount as number,
    type: "REFUND",
    description: reason || `Reversal of penalty (${penalty.reason})`,
    createdById: actor.id,
    relatedType: "Penalty",
    relatedId: penalty.id as string,
    reversesId: penalty.transactionId as string
  });
  await walletTransactions().updateOne(
    { id: penalty.transactionId },
    { $set: { status: "REVERSED", reversedById: rev.id } }
  );
  const reversal = await penalties().findOneAndUpdate(
    { id: penalty.id },
    { $set: { status: "REVERSED", reversedAt: new Date(), reversalTransactionId: rev.id } },
    { returnDocument: "after" }
  );

  await audit({
    clubId,
    actorUserId: actor.id,
    action: AUDIT_ACTIONS.PENALTY_REVERSED,
    entityType: "Penalty",
    entityId: penalty.id as string,
    previousValue: { status: "ACTIVE", amount: penalty.amount },
    newValue: { status: "REVERSED", reason }
  });
  await notify({
    userId: penalty.userId as string,
    clubId,
    type: "PENALTY_ADDED",
    title: "Penalty reversed",
    body: `₹${penalty.amount} credited back — ${reason || penalty.reason}`
  });
  return reversal;
}

export async function listPenalties(clubId: string, opts: { userId?: string; page?: number; pageSize?: number }) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, opts.pageSize ?? 25));
  const filter: Record<string, unknown> = { clubId };
  if (opts.userId) filter.userId = opts.userId;
  const skip = (page - 1) * pageSize;

  const [items, total] = await Promise.all([
    penalties().aggregate([
      { $match: filter },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: pageSize },
      {
        $lookup: {
          from: "users",
          let: { uid: "$userId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$id", "$$uid"] } } },
            { $project: { id: 1, name: 1, photoUrl: 1, _id: 0 } }
          ],
          as: "user"
        }
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } }
    ]).toArray(),
    penalties().countDocuments(filter)
  ]);
  const all = await penalties().find({ clubId }, { projection: { amount: 1, createdAt: 1 } }).toArray();
  return { items, total, page, pageSize, summary: penaltySummary(all as any, new Date()) };
}

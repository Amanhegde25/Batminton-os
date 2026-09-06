import { prisma, type Tx } from "@/server/db";
import { ApiError } from "@/lib/api";
import { AUDIT_ACTIONS, type PenaltyEvent } from "@/lib/constants";
import { matchRule, penaltySummary, type RuleLite } from "@/lib/engines/penalty-engine";
import { audit } from "./audit";
import { notify } from "./notifications";
import { postTransaction } from "./wallets";

export async function listRules(clubId: string) {
  return prisma.penaltyRule.findMany({ where: { clubId }, orderBy: [{ eventType: "asc" }, { label: "asc" }] });
}

export async function upsertRule(
  clubId: string,
  actor: { id: string },
  input: { eventType: PenaltyEvent; label: string; amount: number; enabled: boolean }
) {
  if (input.amount < 0) throw ApiError.badRequest("Amount cannot be negative");
  const existing = await prisma.penaltyRule.findFirst({
    where: { clubId, eventType: input.eventType, label: input.label }
  });
  let rule;
  if (existing) {
    rule = await prisma.penaltyRule.update({
      where: { id: existing.id },
      data: { amount: input.amount, enabled: input.enabled }
    });
  } else {
    rule = await prisma.penaltyRule.create({
      data: { clubId, eventType: input.eventType, label: input.label, amount: input.amount, enabled: input.enabled }
    });
  }
  await audit({
    clubId,
    actorUserId: actor.id,
    action: AUDIT_ACTIONS.RULE_UPSERTED,
    entityType: "PenaltyRule",
    entityId: rule.id,
    previousValue: existing ? { amount: existing.amount, enabled: existing.enabled } : null,
    newValue: { eventType: rule.eventType, label: rule.label, amount: rule.amount, enabled: rule.enabled }
  });
  return rule;
}

export async function deleteRule(clubId: string, actor: { id: string }, ruleId: string) {
  const rule = await prisma.penaltyRule.findFirst({ where: { id: ruleId, clubId } });
  if (!rule) throw ApiError.notFound("Rule not found");
  const updated = await prisma.penaltyRule.update({ where: { id: ruleId }, data: { enabled: false } });
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
  db: Tx,
  clubId: string,
  userId: string,
  eventType: PenaltyEvent,
  opts: IssueEventOptions = {}
) {
  const rules = (await db.penaltyRule.findMany({ where: { clubId } })) as unknown as RuleLite[];
  const rule = matchRule(rules, eventType);
  if (!rule || rule.amount <= 0) return null;
  const txnType = `PENALTY_${eventType}`;
  const txn = await postTransaction(db, {
    clubId,
    userId,
    amount: -rule.amount,
    type: txnType,
    description: opts.reason || `Penalty: ${rule.label}`,
    createdById: opts.createdById ?? null,
    relatedType: opts.relatedType ?? null,
    relatedId: opts.relatedId ?? null
  });
  const penalty = await db.penalty.create({
    data: {
      clubId,
      ruleId: (rule as any).id ?? null,
      userId,
      eventType,
      amount: rule.amount,
      reason: opts.reason || rule.label,
      transactionId: txn.id,
      relatedType: opts.relatedType ?? null,
      relatedId: opts.relatedId ?? null,
      createdById: opts.createdById ?? null
    }
  });
  await db.walletTransaction.update({
    where: { id: txn.id },
    data: { relatedType: "Penalty", relatedId: penalty.id }
  });
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
    const rule = await prisma.penaltyRule.findFirst({
      where: { clubId, eventType: input.eventType, ...(input.label ? { label: input.label } : {}), enabled: true }
    });
    if (!rule) throw ApiError.badRequest(`No enabled rule for ${input.eventType}. Provide an explicit amount.`);
    amount = rule.amount;
    label = rule.label;
    ruleId = rule.id;
  }
  const result = await prisma.$transaction(async (tx) => {
    const txn = await postTransaction(tx, {
      clubId,
      userId: input.userId,
      amount: -amount!,
      type: `PENALTY_${input.eventType}`,
      description: input.reason || label,
      createdById: actor.id
    });
    return tx.penalty.create({
      data: {
        clubId,
        ruleId,
        userId: input.userId,
        eventType: input.eventType,
        amount: amount!,
        reason: input.reason || label,
        transactionId: txn.id,
        createdById: actor.id
      }
    });
    }, { timeout: 20000, maxWait: 10000 });
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
  const penalty = await prisma.penalty.findFirst({ where: { id: penaltyId, clubId } });
  if (!penalty) throw ApiError.notFound("Penalty not found");
  if (penalty.status === "REVERSED") throw ApiError.conflict("Penalty already reversed");
  if (!penalty.transactionId) throw ApiError.badRequest("Penalty has no linked transaction to reverse");
  const reversal = await prisma.$transaction(async (tx) => {
    const rev = await postTransaction(tx, {
      clubId,
      userId: penalty.userId,
      amount: penalty.amount,
      type: "REFUND",
      description: reason || `Reversal of penalty (${penalty.reason})`,
      createdById: actor.id,
      relatedType: "Penalty",
      relatedId: penalty.id,
      reversesId: penalty.transactionId!
    });
    await tx.walletTransaction.update({
      where: { id: penalty.transactionId! },
      data: { status: "REVERSED", reversedById: rev.id }
    });
    return tx.penalty.update({
      where: { id: penalty.id },
      data: { status: "REVERSED", reversedAt: new Date(), reversalTransactionId: rev.id }
    });
    }, { timeout: 20000, maxWait: 10000 });
  await audit({
    clubId,
    actorUserId: actor.id,
    action: AUDIT_ACTIONS.PENALTY_REVERSED,
    entityType: "Penalty",
    entityId: penalty.id,
    previousValue: { status: "ACTIVE", amount: penalty.amount },
    newValue: { status: "REVERSED", reason }
  });
  await notify({
    userId: penalty.userId,
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
  const where = { clubId, ...(opts.userId ? { userId: opts.userId } : {}) };
  const [items, total] = await Promise.all([
    prisma.penalty.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: { select: { id: true, name: true, photoUrl: true } } }
    }),
    prisma.penalty.count({ where })
  ]);
  const all = await prisma.penalty.findMany({ where: { clubId }, select: { amount: true, createdAt: true } });
  return { items, total, page, pageSize, summary: penaltySummary(all, new Date()) };
}

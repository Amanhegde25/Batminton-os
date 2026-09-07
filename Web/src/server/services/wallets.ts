import { prisma, type Tx } from "@/server/db";
import { ApiError } from "@/lib/api";
import { AUDIT_ACTIONS } from "@/lib/constants";
import { audit } from "./audit";
import { notify } from "./notifications";

export interface PostTxnInput {
  clubId: string;
  userId: string;
  amount: number;
  type: string;
  description?: string;
  createdById?: string | null;
  relatedType?: string | null;
  relatedId?: string | null;
  reversesId?: string | null;
}

export async function ensureWallet(db: Tx, clubId: string, userId: string) {
  return db.wallet.upsert({
    where: { clubId_userId: { clubId, userId } },
    create: { clubId, userId },
    update: {}
  });
}

export async function postTransaction(db: Tx, input: PostTxnInput) {
  if (!Number.isInteger(input.amount) || input.amount === 0) {
    throw ApiError.badRequest("Transaction amount must be a non-zero integer (₹)");
  }
  const wallet = await ensureWallet(db, input.clubId, input.userId);
  const balanceAfter = wallet.balance + input.amount;
  await db.wallet.update({
    where: { id: wallet.id },
    data: {
      balance: balanceAfter,
      totalCredited: input.amount > 0 ? { increment: input.amount } : { increment: 0 },
      totalDebited: input.amount < 0 ? { increment: Math.abs(input.amount) } : { increment: 0 }
    }
  });
  const txn = await db.walletTransaction.create({
    data: {
      clubId: input.clubId,
      walletId: wallet.id,
      userId: input.userId,
      amount: input.amount,
      balanceAfter,
      type: input.type,
      status: "COMPLETED",
      description: input.description ?? null,
      relatedType: input.relatedType ?? null,
      relatedId: input.relatedId ?? null,
      reversesId: input.reversesId ?? null,
      createdById: input.createdById ?? null
    }
  });
  return txn;
}

export async function getMyWallet(clubId: string, userId: string) {
  const wallet = await prisma.wallet.findUnique({
    where: { clubId_userId: { clubId, userId } },
    include: { transactions: { orderBy: { createdAt: "desc" }, take: 10 } }
  });
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const agg = await prisma.walletTransaction.aggregate({
    where: { clubId, userId, createdAt: { gte: monthStart } },
    _sum: { amount: true }
  });
  const creditsAgg = await prisma.walletTransaction.aggregate({
    where: { clubId, userId, createdAt: { gte: monthStart }, amount: { gt: 0 } },
    _sum: { amount: true }
  });
  const debitsAgg = await prisma.walletTransaction.aggregate({
    where: { clubId, userId, createdAt: { gte: monthStart }, amount: { lt: 0 } },
    _sum: { amount: true }
  });
  const balance = wallet?.balance ?? 0;
  return {
    wallet: wallet
      ? { id: wallet.id, balance: wallet.balance, totalCredited: wallet.totalCredited, totalDebited: wallet.totalDebited }
      : null,
    pendingDues: Math.max(0, -balance),
    monthCredit: creditsAgg._sum.amount ?? 0,
    monthDebit: Math.abs(debitsAgg._sum.amount ?? 0),
    monthNet: agg._sum.amount ?? 0,
    recentTransactions: wallet?.transactions ?? []
  };
}

export async function listClubTransactions(
  clubId: string,
  opts: { userId?: string; type?: string; page?: number; pageSize?: number }
) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, opts.pageSize ?? 25));
  const where = {
    clubId,
    ...(opts.userId ? { userId: opts.userId } : {}),
    ...(opts.type ? { type: opts.type } : {})
  };
  const [items, total] = await Promise.all([
    prisma.walletTransaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: { select: { id: true, name: true, photoUrl: true } } }
    }),
    prisma.walletTransaction.count({ where })
  ]);
  return { items, total, page, pageSize };
}

export async function clubBalances(clubId: string) {
  const wallets = await prisma.wallet.findMany({
    where: { clubId },
    include: { user: { select: { id: true, name: true, photoUrl: true } } },
    orderBy: { balance: "desc" }
  });
  const totalDue = wallets.reduce((s, w) => s + Math.max(0, -w.balance), 0);
  const debtors = wallets.filter((w) => w.balance < 0).length;
  return { members: wallets, totals: { outstanding: totalDue, membersInDues: debtors } };
}

export async function manualAdjust(
  clubId: string,
  actor: SessionLike,
  input: { userId: string; amount: number; type: string; description: string }
) {
  const txn = await prisma.$transaction((tx) =>
    postTransaction(tx, {
      clubId,
      userId: input.userId,
      amount: input.amount,
      type: input.type,
      description: input.description,
      createdById: actor.id
    })
  );
  await audit({
    clubId,
    actorUserId: actor.id,
    action: AUDIT_ACTIONS.WALLET_ADJUSTED,
    entityType: "WalletTransaction",
    entityId: txn.id,
    newValue: { amount: txn.amount, type: txn.type, description: txn.description }
  });
  await notify({
    userId: input.userId,
    clubId,
    type: "WALLET_ADJUSTED",
    title: input.amount > 0 ? "Wallet credited" : "Amount debited",
    body: `${input.amount > 0 ? "+" : ""}₹${input.amount} — ${input.description}`,
    data: { transactionId: txn.id }
  });
  return txn;
}

export async function refundTransaction(clubId: string, actor: SessionLike, transactionId: string, reason?: string) {
  const original = await prisma.walletTransaction.findFirst({ where: { id: transactionId, clubId } });
  if (!original) throw ApiError.notFound("Transaction not found");
  if (original.status === "REVERSED") throw ApiError.conflict("Transaction already reversed");
  const reversal = await prisma.$transaction(async (tx) => {
    const rev = await postTransaction(tx, {
      clubId,
      userId: original.userId,
      amount: -original.amount,
      type: "REFUND",
      description: reason || `Reversal of ${original.type}`,
      createdById: actor.id,
      relatedType: "WalletTransaction",
      relatedId: original.id,
      reversesId: original.id
    });
    await tx.walletTransaction.update({
      where: { id: original.id },
      data: { status: "REVERSED", reversedById: rev.id }
    });
    return rev;
    }, { timeout: 20000, maxWait: 10000 });
  await audit({
    clubId,
    actorUserId: actor.id,
    action: AUDIT_ACTIONS.WALLET_REFUND,
    entityType: "WalletTransaction",
    entityId: reversal.id,
    previousValue: { transactionId: original.id, amount: original.amount },
    newValue: { reversalId: reversal.id, amount: reversal.amount }
  });
  await notify({
    userId: original.userId,
    clubId,
    type: "WALLET_ADJUSTED",
    title: "Refund processed",
    body: `₹${Math.abs(original.amount)} refunded — ${reason || original.description || original.type}`
  });
  return reversal;
}

interface SessionLike {
  id: string;
}

import { wallets, walletTransactions, users } from "@/server/db";
import { ApiError } from "@/lib/api";
import { AUDIT_ACTIONS } from "@/lib/constants";
import { audit } from "./audit";
import { notify } from "./notifications";
import { cuid } from "@/lib/id";

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

/** Tx type — not used for actual MongoDB transactions, kept for API compat */
export type Tx = { wallets: typeof wallets; walletTransactions: typeof walletTransactions };

const txProxy: Tx = { wallets, walletTransactions };

export async function ensureWallet(_db: unknown, clubId: string, userId: string) {
  const existing = await wallets().findOne({ clubId, userId });
  if (existing) return existing;
  const wallet = {
    id: cuid(),
    clubId,
    userId,
    balance: 0,
    totalCredited: 0,
    totalDebited: 0,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  await wallets().insertOne(wallet);
  return wallet;
}

export async function postTransaction(_db: unknown, input: PostTxnInput) {
  if (!Number.isInteger(input.amount) || input.amount === 0) {
    throw ApiError.badRequest("Transaction amount must be a non-zero integer (₹)");
  }
  const wallet = await ensureWallet(null, input.clubId, input.userId);
  const balanceAfter = (wallet.balance as number) + input.amount;
  const incData: Record<string, number> = { balance: input.amount };
  if (input.amount > 0) incData.totalCredited = input.amount;
  if (input.amount < 0) incData.totalDebited = Math.abs(input.amount);
  await wallets().updateOne(
    { id: wallet.id },
    { $inc: incData, $set: { updatedAt: new Date() } }
  );
  const txn = {
    id: cuid(),
    clubId: input.clubId,
    walletId: wallet.id as string,
    userId: input.userId,
    amount: input.amount,
    balanceAfter,
    type: input.type,
    status: "COMPLETED",
    description: input.description ?? null,
    relatedType: input.relatedType ?? null,
    relatedId: input.relatedId ?? null,
    reversesId: input.reversesId ?? null,
    reversedById: null,
    createdById: input.createdById ?? null,
    createdAt: new Date()
  };
  await walletTransactions().insertOne(txn);
  return txn;
}

export async function getMyWallet(clubId: string, userId: string) {
  const wallet = await wallets().findOne({ clubId, userId });
  const recentTxns = wallet
    ? await walletTransactions().find({ walletId: wallet.id }).sort({ createdAt: -1 }).limit(10).toArray()
    : [];
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const aggPipeline = (extraMatch: Record<string, unknown> = {}) => [
    { $match: { clubId, userId, createdAt: { $gte: monthStart }, ...extraMatch } },
    { $group: { _id: null, total: { $sum: "$amount" } } }
  ];
  const [aggResult, creditsResult, debitsResult] = await Promise.all([
    walletTransactions().aggregate(aggPipeline()).toArray(),
    walletTransactions().aggregate(aggPipeline({ amount: { $gt: 0 } })).toArray(),
    walletTransactions().aggregate(aggPipeline({ amount: { $lt: 0 } })).toArray()
  ]);
  const balance = (wallet?.balance as number) ?? 0;
  return {
    wallet: wallet
      ? { id: wallet.id, balance: wallet.balance, totalCredited: wallet.totalCredited, totalDebited: wallet.totalDebited }
      : null,
    pendingDues: Math.max(0, -balance),
    monthCredit: creditsResult[0]?.total ?? 0,
    monthDebit: Math.abs(debitsResult[0]?.total ?? 0),
    monthNet: aggResult[0]?.total ?? 0,
    recentTransactions: recentTxns
  };
}

export async function listClubTransactions(
  clubId: string,
  opts: { userId?: string; type?: string; page?: number; pageSize?: number }
) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, opts.pageSize ?? 25));
  const filter: Record<string, unknown> = { clubId };
  if (opts.userId) filter.userId = opts.userId;
  if (opts.type) filter.type = opts.type;
  const skip = (page - 1) * pageSize;

  const [items, total] = await Promise.all([
    walletTransactions().aggregate([
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
    walletTransactions().countDocuments(filter)
  ]);
  return { items, total, page, pageSize };
}

export async function clubBalances(clubId: string) {
  const walletList = await wallets().aggregate([
    { $match: { clubId } },
    { $sort: { balance: -1 } },
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
  ]).toArray();
  const totalDue = walletList.reduce((s, w) => s + Math.max(0, -(w.balance as number)), 0);
  const debtors = walletList.filter((w) => (w.balance as number) < 0).length;
  return { members: walletList, totals: { outstanding: totalDue, membersInDues: debtors } };
}

export async function manualAdjust(
  clubId: string,
  actor: SessionLike,
  input: { userId: string; amount: number; type: string; description: string }
) {
  const txn = await postTransaction(null, {
    clubId,
    userId: input.userId,
    amount: input.amount,
    type: input.type,
    description: input.description,
    createdById: actor.id
  });
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
  const original = await walletTransactions().findOne({ id: transactionId, clubId });
  if (!original) throw ApiError.notFound("Transaction not found");
  if (original.status === "REVERSED") throw ApiError.conflict("Transaction already reversed");

  const rev = await postTransaction(null, {
    clubId,
    userId: original.userId as string,
    amount: -(original.amount as number),
    type: "REFUND",
    description: reason || `Reversal of ${original.type}`,
    createdById: actor.id,
    relatedType: "WalletTransaction",
    relatedId: original.id as string,
    reversesId: original.id as string
  });
  await walletTransactions().updateOne(
    { id: original.id },
    { $set: { status: "REVERSED", reversedById: rev.id } }
  );

  await audit({
    clubId,
    actorUserId: actor.id,
    action: AUDIT_ACTIONS.WALLET_REFUND,
    entityType: "WalletTransaction",
    entityId: rev.id,
    previousValue: { transactionId: original.id, amount: original.amount },
    newValue: { reversalId: rev.id, amount: rev.amount }
  });
  await notify({
    userId: original.userId as string,
    clubId,
    type: "WALLET_ADJUSTED",
    title: "Refund processed",
    body: `₹${Math.abs(original.amount as number)} refunded — ${reason || original.description || original.type}`
  });
  return rev;
}

interface SessionLike {
  id: string;
}

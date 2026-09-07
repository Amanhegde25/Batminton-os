import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const TEST_DB = path.resolve("prisma/test-wallet.db").replace(/\\/g, "/");
process.env.DATABASE_URL = `file:${TEST_DB}`;

type Db = typeof import("@/server/db");
type Wallets = typeof import("@/server/services/wallets");
type UsersSvc = typeof import("@/server/services/users");

let db!: Db;
let wallets!: Wallets;
let usersSvc!: UsersSvc;

let clubId!: string;
let userIdA!: string;
let userIdB!: string;

beforeAll(async () => {
  if (!fs.existsSync(path.resolve("prisma/dev.db"))) {
    throw new Error("prisma/dev.db missing — run `npm run db:push` (and optionally seed) before tests");
  }
  fs.copyFileSync(path.resolve("prisma/dev.db"), TEST_DB);

  db = await import("@/server/db");
  wallets = await import("@/server/services/wallets");
  usersSvc = await import("@/server/services/users");

  for (const t of ["walletTransaction", "wallet"] as const) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db.prisma as any)[t].deleteMany({});
  }
  const owner = await db.prisma.user.create({
    data: { email: "ledger-test@example.com", name: "Ledger Test", passwordHash: null }
  });
  const club = await db.prisma.club.create({
    data: { name: "Ledger Test Club", slug: `ledger-test-${Date.now()}`, ownerId: owner.id }
  });
  clubId = club.id;
  const a = await db.prisma.user.create({
    data: { email: "ledger-a@example.com", name: "Member A", passwordHash: null }
  });
  const b = await db.prisma.user.create({
    data: { email: "ledger-b@example.com", name: "Member B", passwordHash: null }
  });
  userIdA = a.id;
  userIdB = b.id;
});

afterAll(async () => {
  await db.prisma.$disconnect();
  try {
    fs.rmSync(TEST_DB, { force: true });
  } catch {}
});

describe("wallet ledger", () => {
  it("credits, debits and tracks running balances", async () => {
    const t1 = await wallets.postTransaction(db.prisma, {
      clubId,
      userId: userIdA,
      amount: 50000,
      type: "OPENING_CREDIT",
      description: "top-up"
    });
    expect(t1.amount).toBe(50000);
    expect(t1.balanceAfter).toBe(50000);

    const t2 = await wallets.postTransaction(db.prisma, {
      clubId,
      userId: userIdA,
      amount: -12000,
      type: "PENALTY_LATE"
    });
    expect(t2.balanceAfter).toBe(38000);

    const mine = await wallets.getMyWallet(clubId, userIdA);
    expect(mine.wallet?.balance).toBe(38000);
    expect(mine.recentTransactions.map((t) => t.balanceAfter)).toEqual([38000, 50000]);
  });

  it("keeps wallets isolated per member", async () => {
    await wallets.postTransaction(db.prisma, {
      clubId,
      userId: userIdB,
      amount: 100,
      type: "OPENING_CREDIT"
    });
    const b = await wallets.getMyWallet(clubId, userIdB);
    const a = await wallets.getMyWallet(clubId, userIdA);
    expect(b.wallet?.balance).toBe(100);
    expect(a.wallet?.balance).toBe(38000);
  });

  it("rejects zero and fractional amounts", async () => {
    await expect(
      wallets.postTransaction(db.prisma, { clubId, userId: userIdB, amount: 0, type: "ADJUSTMENT" })
    ).rejects.toThrow();
    await expect(
      wallets.postTransaction(db.prisma, { clubId, userId: userIdB, amount: 10.5, type: "ADJUSTMENT" })
    ).rejects.toThrow();
  });

  it("reverses a transaction once and restores balance", async () => {
    const debit = await wallets.postTransaction(db.prisma, {
      clubId,
      userId: userIdA,
      amount: -5000,
      type: "PENALTY_ABSENCE",
      description: "missed session"
    });

    const actor = { id: userIdA };
    const reversal = await wallets.refundTransaction(clubId, actor, debit.id, "goodwill");
    expect(reversal.amount).toBe(5000);
    expect(reversal.type).toBe("REFUND");

    const after = await wallets.getMyWallet(clubId, userIdA);
    expect(after.wallet?.balance).toBe(38000);

    const original = await db.prisma.walletTransaction.findUnique({ where: { id: debit.id } });
    expect(original?.status).toBe("REVERSED");

    await expect(wallets.refundTransaction(clubId, actor, debit.id)).rejects.toThrow(/already reversed/i);
  });

  it("maintains the ledger invariant under a random op sequence", async () => {
    let state = 12345;
    const rng = () => {
      state = (state * 48271) % 2147483647;
      return state / 2147483647;
    };

    let expectedBalance =
      (
        await db.prisma.wallet.findUnique({
          where: { clubId_userId: { clubId, userId: userIdB } }
        })
      )?.balance ?? 0;

    for (let i = 0; i < 12; i++) {
      const amt = Math.round((rng() * 4000 + 100)) * (rng() < 0.5 ? -1 : 1);
      const txn = await wallets.postTransaction(db.prisma, {
        clubId,
        userId: userIdB,
        amount: amt,
        type: amt > 0 ? "CREDIT" : "DEBIT"
      });
      expectedBalance += amt;
      expect(txn.balanceAfter).toBe(expectedBalance);
    }

    const wallet = await db.prisma.wallet.findUnique({
      where: { clubId_userId: { clubId, userId: userIdB } }
    });
    const txns = await db.prisma.walletTransaction.findMany({ where: { clubId, userId: userIdB } });
    const net = txns.filter((t) => t.status === "COMPLETED").reduce((s, t) => s + t.amount, 0);
    expect(wallet!.balance).toBe(net);
    expect(wallet!.balance).toBe(expectedBalance);
    expect(wallet!.totalCredited).toBe(txns.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0));
    expect(wallet!.totalDebited).toBe(-txns.filter((t) => t.amount < 0 && t.status !== "REVERSED").reduce((s, t) => s + t.amount, 0));
  });

  it("reports null wallet for members without one", async () => {
    const c = await usersSvc.registerUser({
      name: "No Wallet",
      email: `no-wallet-${Date.now()}@example.com`,
      password: "Password123!"
    });
    const mine = await wallets.getMyWallet(clubId, c.id);
    expect(mine.wallet).toBeNull();
  });
});

"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/components/session";
import { api } from "@/lib/client";
import { Badge, Button, Field, Input, Select, Spinner, StatCard } from "@/components/ui";
import { Dialog, Table, Tabs, Td, useToast } from "@/components/ui";

interface Txn {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string | null;
  createdAt: string;
  status: string;
  user?: { id: string; name: string; photoUrl: string | null };
}
interface MyWallet {
  wallet: { id: string; balance: number; totalCredited: number; totalDebited: number } | null;
  pendingDues: number;
  monthCredit: number;
  monthDebit: number;
  monthNet: number;
}
interface TxnPage {
  items: Txn[];
  total: number;
  page: number;
  pageSize: number;
}
interface Balances {
  members: { userId: string; balance: number; user: { id: string; name: string; photoUrl: string | null } }[];
  totals: { outstanding: number; membersInDues: number };
}
interface MemberLite {
  userId: string;
  name: string;
  email: string;
}

const TYPE_TONE: Record<string, string> = {
  PENALTY: "danger",
  BOOKING_FEE: "warning",
  TOURNAMENT_FEE: "warning",
  REFUND: "success",
  MANUAL_CREDIT: "success",
  OPENING_CREDIT: "success"
};

function money(n: number) {
  return `₹${(Math.abs(n) / 100).toLocaleString("en-IN")}`;
}

function WalletInner() {
  const { activeClubId, activeMembership } = useSession();
  const [tab, setTab] = useState("mine");
  const [mine, setMine] = useState<MyWallet | null>(null);
  const [txns, setTxns] = useState<TxnPage | null>(null);
  const [balances, setBalances] = useState<Balances | null>(null);
  const [page, setPage] = useState(1);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast, node } = useToast();

  const isStaff = ["OWNER", "ADMIN"].includes(activeMembership?.role ?? "");

  async function load(p = page) {
    if (!activeClubId) return;
    setLoading(true);
    try {
      if (tab === "mine") {
        const [w, t] = await Promise.all([
          api<MyWallet>(`/clubs/${activeClubId}/wallet`),
          api<TxnPage>(`/clubs/${activeClubId}/wallet/transactions?page=${p}`)
        ]);
        setMine(w);
        setTxns(t);
      } else {
        setBalances(await api<Balances>(`/clubs/${activeClubId}/wallet/transactions?view=balances`));
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to load wallet", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(1);
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClubId, tab]);

  async function refund(txn: Txn) {
    try {
      await api(`/clubs/${activeClubId}/wallet/refund`, {
        method: "POST",
        json: { transactionId: txn.id, reason: "Reversed by staff" }
      });
      toast("Transaction reversed");
      void load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Refund failed", "error");
    }
  }

  const items = txns?.items ?? [];
  const totalPages = txns ? Math.ceil(txns.total / txns.pageSize) : 1;

  return (
    <div className="space-y-4">
      {node}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Wallet</h1>
        <div className="flex gap-2">
          <Tabs
            tabs={isStaff ? [{ key: "mine", label: "My ledger" }, { key: "club", label: "Club balances" }] : [{ key: "mine", label: "My ledger" }]}
            active={tab}
            onChange={setTab}
          />
          {isStaff && <Button onClick={() => setAdjustOpen(true)}>Manual entry</Button>}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : tab === "mine" ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Balance"
              value={money(mine?.wallet?.balance ?? 0)}
              sub={mine && mine.pendingDues > 0 ? `${money(mine.pendingDues)} unpaid penalties` : "All clear"}
            />
            <StatCard label="Credits (30d)" value={money(mine?.monthCredit ?? 0)} />
            <StatCard label="Debits (30d)" value={money(mine?.monthDebit ?? 0)} />
            <StatCard
              label="Net (30d)"
              value={(mine?.monthNet ?? 0) >= 0 ? `+${money(mine?.monthNet ?? 0)}` : `−${money(mine?.monthNet ?? 0)}`}
            />
          </div>

          <Table head={["Type", "Member", "Amount", "Balance after", "Description", "When", ""]}>
            {items.map((t) => (
              <tr key={t.id} className="border-b last:border-0">
                <Td>
                  <Badge tone={(TYPE_TONE[t.type] as never) ?? "muted"}>
                    {t.status === "REVERSED" ? `${t.type.toLowerCase()} · reversed` : t.type.replace(/_/g, " ").toLowerCase()}
                  </Badge>
                </Td>
                <Td>{t.user?.name ?? "—"}</Td>
                <Td className={`tabular-nums font-medium ${t.amount < 0 ? "text-destructive" : "text-emerald-600"}`}>
                  {t.amount < 0 ? "−" : "+"}
                  {money(t.amount)}
                </Td>
                <Td className="tabular-nums">{money(t.balanceAfter)}</Td>
                <Td className="max-w-[220px] truncate text-xs text-muted-foreground">{t.description}</Td>
                <Td className="text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleDateString()}</Td>
                <Td>
                  {isStaff && t.status === "COMPLETED" && Math.abs(t.amount) > 0 && (
                    <Button size="sm" variant="ghost" onClick={() => refund(t)}>
                      Reverse
                    </Button>
                  )}
                </Td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <Td colSpan={7} className="py-10 text-center text-muted-foreground">
                  No transactions yet.
                </Td>
              </tr>
            )}
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); void load(p); }}>
                ← Prev
              </Button>
              <span className="text-muted-foreground">Page {page} of {totalPages}</span>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => { const p = page + 1; setPage(p); void load(p); }}>
                Next →
              </Button>
            </div>
          )}
        </>
      ) : balances ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:max-w-md">
            <StatCard label="Outstanding dues" value={money(balances.totals.outstanding)} />
            <StatCard label="Members in dues" value={balances.totals.membersInDues} />
          </div>
          <Table head={["Member", "Balance"]}>
            {balances.members.map((b) => (
              <tr key={b.userId} className="border-b last:border-0">
                <Td>{b.user.name}</Td>
                <Td className={`tabular-nums ${b.balance < 0 ? "text-destructive" : ""}`}>{money(b.balance)}</Td>
              </tr>
            ))}
            {balances.members.length === 0 && (
              <tr>
                <Td colSpan={2} className="py-10 text-center text-muted-foreground">
                  No wallets yet.
                </Td>
              </tr>
            )}
          </Table>
        </>
      ) : null}

      <AdjustDialog open={adjustOpen} onClose={() => setAdjustOpen(false)} onSubmit={async (f) => {
        await api(`/clubs/${activeClubId}/wallet/transactions`, { method: "POST", json: f });
        toast("Ledger updated");
        setAdjustOpen(false);
        void load();
      }} clubId={activeClubId ?? ""} />
    </div>
  );
}

function AdjustDialog({
  open,
  onClose,
  onSubmit,
  clubId
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (form: { userId: string; amount: number; type: string; description: string }) => Promise<void>;
  clubId: string;
}) {
  const [form, setForm] = useState({ userId: "", amount: "", type: "MANUAL_CREDIT", description: "" });
  const [members, setMembers] = useState<MemberLite[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !clubId) return;
    void api<MemberLite[]>(`/clubs/${clubId}/members?status=ACTIVE`)
      .then(setMembers)
      .catch(() => {});
  }, [open, clubId]);

  return (
    <Dialog open={open} onClose={onClose} title="Manual wallet entry">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
          const rawAmount = Math.round(Number(form.amount) * 100);
          const amount = form.type === "MANUAL_DEBIT" ? -Math.abs(rawAmount) : Math.abs(rawAmount);
          await onSubmit({
            userId: form.userId,
            amount,
            type: form.type === "MANUAL_DEBIT" ? "MANUAL_DEBIT" : form.type,
            description: form.description
          });
          setForm({ userId: "", amount: "", type: "MANUAL_CREDIT", description: "" });
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Member">
          <Select required value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })}>
            <option value="">Select a member…</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name} ({m.email})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Amount (₹)" hint="Negative amounts are debits.">
          <Input type="number" step="any" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </Field>
        <Field label="Type">
          <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="MANUAL_CREDIT">Credit — top-up</option>
            <option value="MANUAL_DEBIT">Debit — charge</option>
            <option value="OTHER">Other</option>
          </Select>
        </Field>
        <Field label="Description">
          <Input required minLength={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Court fee settlement" />
        </Field>
        <Button type="submit" disabled={busy || !form.userId} className="w-full">
          {busy ? "Posting…" : "Post to ledger"}
        </Button>
      </form>
    </Dialog>
  );
}

export default function WalletPage() {
  return <WalletInner />;
}

"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/components/session";
import { api } from "@/lib/client";
import { Badge, Button, Card, Field, Input, Select, Spinner, StatCard } from "@/components/ui";
import { Dialog, Table, Tabs, Td, useToast } from "@/components/ui";
import { ShieldCheck } from "@/components/icons";

interface PenaltyRow {
  id: string;
  userId: string;
  eventType: string;
  label: string | null;
  reason: string | null;
  amount: number;
  status: string;
  createdAt: string;
  user: { id: string; name: string; photoUrl: string | null };
}
interface PenaltyList {
  items: PenaltyRow[];
  total: number;
  page: number;
  pageSize: number;
  summary: { today: { count: number; amount: number }; week: { count: number; amount: number }; month: { count: number; amount: number }; year: { count: number; amount: number }; allTime: { count: number; amount: number } };
}
interface Rule {
  id: string;
  eventType: string;
  label: string;
  amount: number;
  enabled: boolean;
}

function money(n: number) {
  return `₹${(Math.abs(n) / 100).toLocaleString("en-IN")}`;
}

function PenaltiesInner() {
  const { activeClubId, activeMembership } = useSession();
  const [tab, setTab] = useState("ledger");
  const [list, setList] = useState<PenaltyList | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [issueOpen, setIssueOpen] = useState(false);
  const { toast, node } = useToast();

  const isStaff = ["OWNER", "ADMIN"].includes(activeMembership?.role ?? "");

  async function load() {
    if (!activeClubId) return;
    setLoading(true);
    try {
      if (tab === "rules") {
        if (isStaff) setRules(await api<Rule[]>(`/clubs/${activeClubId}/penalties/rules`));
      } else {
        setList(await api<PenaltyList>(`/clubs/${activeClubId}/penalties`));
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to load", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClubId, tab]);

  async function reverse(id: string) {
    try {
      await api(`/clubs/${activeClubId}/penalties/reverse`, { method: "POST", json: { penaltyId: id, reason: "Waived by staff" } });
      toast("Penalty reversed and refunded");
      void load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Reversal failed", "error");
    }
  }

  async function saveRule(rule: Rule) {
    await api(`/clubs/${activeClubId}/penalties/rules`, { method: "POST", json: rule });
    toast("Rule saved");
    void load();
  }

  async function deleteRule(id: string) {
    await api(`/clubs/${activeClubId}/penalties/rules?id=${id}`, { method: "DELETE" }).catch((err) =>
      toast(err.message ?? "Delete failed", "error")
    );
    void load();
  }

  return (
    <div className="space-y-4">
      {node}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Penalties (lassi)</h1>
        <div className="flex gap-2">
          <Tabs
            tabs={[
              { key: "ledger", label: "Ledger" },
              ...(isStaff ? [{ key: "rules", label: "Rules" }] : [])
            ]}
            active={tab}
            onChange={setTab}
          />
          {isStaff && tab === "ledger" && <Button onClick={() => setIssueOpen(true)}>Issue penalty</Button>}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : tab === "rules" ? (
        <RulesEditor rules={rules} onSave={saveRule} onDelete={deleteRule} />
      ) : list ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Today" value={money(list.summary.today.amount)} sub={`${list.summary.today.count} penalties`} />
            <StatCard label="This week" value={money(list.summary.week.amount)} sub={`${list.summary.week.count} penalties`} />
            <StatCard label="This month" value={money(list.summary.month.amount)} sub={`${list.summary.month.count} penalties`} />
            <StatCard label="All time" value={money(list.summary.allTime.amount)} sub={`${list.summary.allTime.count} penalties`} />
          </div>

          <Table head={["Member", "Event", "Label / reason", "Amount", "Status", "When", isStaff ? "" : undefined].filter(Boolean) as string[]}>
            {list.items.map((p) => (
              <tr key={p.id} className="border-b last:border-0">
                <Td>{p.user.name}</Td>
                <Td>
                  <Badge tone={p.eventType === "ABSENCE" ? "danger" : p.eventType === "LATE" ? "warning" : "muted"}>{p.eventType}</Badge>
                </Td>
                <Td className="max-w-[220px] truncate text-xs text-muted-foreground">{p.label || p.reason}</Td>
                <Td className="tabular-nums font-medium">{money(p.amount)}</Td>
                <Td>
                  <Badge tone={p.status === "ACTIVE" ? "warning" : p.status === "REVERSED" ? "muted" : "success"}>{p.status.toLowerCase()}</Badge>
                </Td>
                <Td className="text-xs text-muted-foreground">{new Date(p.createdAt).toLocaleDateString()}</Td>
                {isStaff && (
                  <Td>
                    {p.status === "ACTIVE" && (
                      <Button size="sm" variant="ghost" onClick={() => reverse(p.id)}>
                        Reverse
                      </Button>
                    )}
                  </Td>
                )}
              </tr>
            ))}
            {list.items.length === 0 && (
              <tr>
                <Td colSpan={isStaff ? 7 : 6} className="py-10 text-center text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <ShieldCheck className="h-6 w-6 text-emerald-500" />
                    <span>No penalties — a disciplined club!</span>
                  </div>
                </Td>
              </tr>
            )}
          </Table>
        </>
      ) : null}

      <IssueDialog open={issueOpen} onClose={() => setIssueOpen(false)} clubId={activeClubId ?? ""} onDone={() => void load()} />
    </div>
  );
}

function RulesEditor({ rules, onSave, onDelete }: { rules: Rule[]; onSave: (r: Rule) => Promise<void>; onDelete: (id: string) => Promise<void> }) {
  const events = ["ABSENCE", "LATE", "LOSS", "WALKOVER", "CUSTOM"];
  return (
    <Card className="p-5">
      <p className="mb-1 text-sm font-semibold">Automatic penalty rules</p>
      <p className="mb-4 text-xs text-muted-foreground">Applied automatically by attendance sweeps and match results.</p>
      <div className="space-y-3">
        {events.map((ev) => {
          const existing = rules.find((r) => r.eventType === ev);
          return (
            <RuleRow
              key={ev}
              eventType={ev}
              rule={existing}
              onSave={onSave}
              onDelete={existing ? () => onDelete(existing.id) : undefined}
            />
          );
        })}
      </div>
    </Card>
  );
}

function RuleRow({
  eventType,
  rule,
  onSave,
  onDelete
}: {
  eventType: string;
  rule?: Rule;
  onSave: (r: Rule) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [label, setLabel] = useState(rule?.label ?? defaultLabel(eventType));
  const [amount, setAmount] = useState(String((rule?.amount ?? defaultAmount(eventType)) / 100));
  const [enabled, setEnabled] = useState(rule?.enabled ?? true);
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border p-3">
      <Badge tone="primary" className="mb-2">{eventType}</Badge>
      <div className="min-w-[160px] flex-1">
        <Field label="Label">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} />
        </Field>
      </div>
      <div className="w-28">
        <Field label="Amount ₹">
          <Input type="number" min={0} step="any" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
      </div>
      <label className="mb-2 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Enabled
      </label>
      <Button
        className="mb-0.5"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onSave({ id: rule?.id ?? "", eventType, label, amount: Math.round(Number(amount) * 100), enabled });
          } finally {
            setBusy(false);
          }
        }}
      >
        Save
      </Button>
      {onDelete && (
        <Button variant="destructive" className="mb-0.5" onClick={onDelete}>
          Delete
        </Button>
      )}
    </div>
  );
}

function defaultLabel(ev: string) {
  return ev === "ABSENCE" ? "Unexcused absence" : ev === "LATE" ? "Late check-in" : ev === "LOSS" ? "Match loss fee" : ev === "WALKOVER" ? "Walkover no-show" : "Custom penalty";
}
function defaultAmount(ev: string) {
  return ev === "ABSENCE" ? 2000 : ev === "LATE" ? 1000 : ev === "LOSS" ? 1000 : ev === "WALKOVER" ? 3000 : 5000;
}

function IssueDialog({ open, onClose, clubId, onDone }: { open: boolean; onClose: () => void; clubId: string; onDone: () => void }) {
  const [members, setMembers] = useState<{ userId: string; name: string; email: string }[]>([]);
  const [form, setForm] = useState({ userId: "", eventType: "CUSTOM", label: "", amount: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !clubId) return;
    void api<{ userId: string; name: string; email: string }[]>(`/clubs/${clubId}/members?status=ACTIVE`)
      .then(setMembers)
      .catch(() => {});
  }, [open, clubId]);

  return (
    <Dialog open={open} onClose={onClose} title="Issue a manual penalty">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api(`/clubs/${clubId}/penalties`, {
              method: "POST",
              json: {
                userId: form.userId,
                eventType: form.eventType,
                label: form.label || undefined,
                amount: Math.round(Number(form.amount) * 100)
              }
            });
            onClose();
            onDone();
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Member">
          <Select required value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })}>
            <option value="">Select…</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Event type">
          <Select value={form.eventType} onChange={(e) => setForm({ ...form, eventType: e.target.value })}>
            {["CUSTOM", "ABSENCE", "LATE", "LOSS", "WALKOVER"].map((ev) => (
              <option key={ev}>{ev}</option>
            ))}
          </Select>
        </Field>
        <Field label="Label">
          <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Damaged shuttle box" />
        </Field>
        <Field label="Amount ₹">
          <Input type="number" min={1} step="any" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </Field>
        <Button type="submit" disabled={busy || !form.userId} className="w-full">
          {busy ? "Issuing…" : "Issue penalty"}
        </Button>
      </form>
    </Dialog>
  );
}

export default function PenaltiesPage() {
  return <PenaltiesInner />;
}

"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/components/session";
import { api } from "@/lib/client";
import { Avatar, Badge, Button, Card, Field, Input, Select, Spinner } from "@/components/ui";
import { Dialog, Table, Tabs, Td, useToast } from "@/components/ui";

interface MemberRow {
  userId: string;
  name: string;
  email: string;
  photoUrl: string | null;
  role: string;
  status: string;
  rating: number;
  balance: number;
  attendanceRate: number;
  joinedAt: string;
}

const ROLES = ["PLAYER", "COACH", "ADMIN", "OWNER"];

function MembersInner() {
  const { activeClubId } = useSession();
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("active");
  const [addOpen, setAddOpen] = useState(false);
  const [pending, setPending] = useState<MemberRow[]>([]);
  const { toast, node } = useToast();

  async function load() {
    if (!activeClubId) return;
    setLoading(true);
    try {
      if (tab === "pending") {
        setPending(await api<MemberRow[]>(`/clubs/${activeClubId}/members?status=PENDING`));
      } else {
        setRows(await api<MemberRow[]>(`/clubs/${activeClubId}/members?q=${encodeURIComponent(q)}&status=ACTIVE`));
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to load members", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClubId, tab]);

  async function addMember(form: { name: string; email: string; role: string }) {
    await api(`/clubs/${activeClubId}/members`, { method: "POST", json: form });
    toast("Member added");
    setAddOpen(false);
    void load();
  }

  async function decide(memberId: string, approve: boolean) {
    try {
      await api(`/clubs/${activeClubId}/members`, {
        method: "POST",
        json: { memberId, action: approve ? "approve" : "reject" }
      });
      toast(approve ? "Approved" : "Rejected");
      void load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Action failed", "error");
    }
  }

  async function changeRole(userId: string, role: string) {
    try {
      await api(`/clubs/${activeClubId}/members`, { method: "PATCH", json: { userId, role } });
      toast("Role updated");
      void load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not change role", "error");
    }
  }

  return (
    <div className="space-y-4">
      {node}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Members</h1>
        <Button onClick={() => setAddOpen(true)}>+ Add member</Button>
      </div>

      <Tabs
        tabs={[
          { key: "active", label: `Active (${rows.length})` },
          { key: "pending", label: "Requests" }
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "active" && (
        <>
          <Input placeholder="Search name or email…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
          {loading ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : (
            <Table head={["Player", "Role", "Rating", "Attendance", "Balance", "Joined"]}>
              {rows.map((r) => (
                <tr key={r.userId} className="border-b last:border-0">
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={r.name} src={r.photoUrl} size={32} />
                      <div>
                        <p className="font-medium">{r.name}</p>
                        <p className="text-xs text-muted-foreground">{r.email}</p>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <Select value={r.role} onChange={(e) => changeRole(r.userId, e.target.value)} className="h-8 w-28 text-xs">
                      {ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </Select>
                  </Td>
                  <Td className="tabular-nums">{Math.round(r.rating)}</Td>
                  <Td>{r.attendanceRate}%</Td>
                  <Td className={`tabular-nums ${r.balance < 0 ? "text-destructive" : ""}`}>
                    ₹{(r.balance / 100).toLocaleString("en-IN")}
                  </Td>
                  <Td className="text-xs text-muted-foreground">{new Date(r.joinedAt).toLocaleDateString()}</Td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <Td colSpan={6} className="py-10 text-center text-muted-foreground">
                    No members found.
                  </Td>
                </tr>
              )}
            </Table>
          )}
        </>
      )}

      {tab === "pending" && (
        <Card className="divide-y">
          {pending.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No pending requests.</p>}
          {pending.map((r) => (
            <div key={r.userId} className="flex items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3">
                <Avatar name={r.name} src={r.photoUrl} size={36} />
                <div>
                  <p className="font-medium">{r.name}</p>
                  <p className="text-xs text-muted-foreground">{r.email}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => decide(r.userId, false)}>
                  Reject
                </Button>
                <Button size="sm" onClick={() => decide(r.userId, true)}>
                  Approve
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      <AddMemberDialog open={addOpen} onClose={() => setAddOpen(false)} onSubmit={addMember} />
    </div>
  );
}

function AddMemberDialog({
  open,
  onClose,
  onSubmit
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (form: { name: string; email: string; role: string }) => Promise<void>;
}) {
  const [form, setForm] = useState({ name: "", email: "", role: "PLAYER" });
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onClose={onClose} title="Add a member">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await onSubmit(form);
            setForm({ name: "", email: "", role: "PLAYER" });
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className="text-sm text-muted-foreground">
          If the person already has an account they're added instantly; otherwise we create a placeholder account they can claim via password reset or OTP.
        </p>
        <Field label="Full name">
          <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Email">
          <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Role">
          <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {ROLES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
        </Field>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Adding…" : "Add member"}
        </Button>
      </form>
    </Dialog>
  );
}

export default function MembersPage() {
  return <MembersInner />;
}

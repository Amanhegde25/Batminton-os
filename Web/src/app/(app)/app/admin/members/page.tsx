"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/components/session";
import { api } from "@/lib/client";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Dialog,
  Input,
  Select,
  Spinner,
  Table,
  Td,
  useToast
} from "@/components/ui";
import {
  Users,
  Search,
  Check,
  X,
  Shield,
  RefreshCw,
  Clock,
  ChevronRight
} from "@/components/icons";

interface MemberRecord {
  id: string;
  userId: string;
  name: string;
  email: string | null;
  mobile: string | null;
  role: "OWNER" | "ADMIN" | "COACH" | "PLAYER";
  status: "ACTIVE" | "PENDING" | "BLOCKED";
  joinedAt: string;
  photoUrl: string | null;
}

export default function ClubAdminMembersPage() {
  const { activeClubId, me } = useSession();
  const myMembership = me?.memberships?.find((m) => m.club?.id === activeClubId);
  const isClubOwner = myMembership?.role === "OWNER" || me?.role === "SUPER_ADMIN";
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "pending">("pending");
  const [actingId, setActingId] = useState<string | null>(null);
  const { toast, node } = useToast();

  async function loadMembers() {
    if (!activeClubId) return;
    setLoading(true);
    try {
      const res = await api<MemberRecord[]>(`/clubs/${activeClubId}/members`);
      setMembers(res);
      // If no pending, default to all
      const hasPending = res.some((m) => m.status === "PENDING");
      if (!hasPending && activeTab === "pending") {
        setActiveTab("all");
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to load members", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMembers();
  }, [activeClubId]);

  async function handleApproval(memberId: string, approve: boolean) {
    if (!activeClubId) return;
    setActingId(memberId);
    try {
      await api(`/clubs/${activeClubId}/members`, {
        method: "POST",
        json: {
          memberId,
          action: approve ? "approve" : "reject"
        }
      });
      toast(`Membership request ${approve ? "approved" : "rejected"}`, "success");
      void loadMembers();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Action failed", "error");
    } finally {
      setActingId(null);
    }
  }

  async function handleRoleChange(memberId: string, newRole: "OWNER" | "ADMIN" | "COACH" | "PLAYER") {
    if (!activeClubId) return;
    setActingId(memberId);
    try {
      await api(`/clubs/${activeClubId}/members`, {
        method: "PATCH",
        json: { memberId, role: newRole }
      });
      toast(`Role updated to ${newRole}`, "success");
      void loadMembers();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Role change failed", "error");
    } finally {
      setActingId(null);
    }
  }

  const pendingMembers = members.filter((m) => m.status === "PENDING");
  const activeMembersList = members.filter((m) => m.status === "ACTIVE" || m.status === "BLOCKED");

  const filteredActive = activeMembersList.filter((m) => {
    const matchesSearch =
      !search ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      (m.email && m.email.toLowerCase().includes(search.toLowerCase()));
    const matchesRole = !roleFilter || m.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      {node}

      {/* Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant={activeTab === "pending" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("pending")}
            className="gap-2 text-xs"
          >
            <span>Pending Approvals</span>
            {pendingMembers.length > 0 && (
              <Badge tone="warning" className="px-1.5 py-0 text-[10px]">
                {pendingMembers.length}
              </Badge>
            )}
          </Button>
          <Button
            variant={activeTab === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("all")}
            className="gap-2 text-xs"
          >
            <span>Active Roster</span>
            <span className="text-muted-foreground font-mono text-[11px]">({activeMembersList.length})</span>
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadMembers()}
          disabled={loading}
          className="gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner className="h-8 w-8 text-primary" />
        </div>
      ) : activeTab === "pending" ? (
        /* Pending Approvals Queue */
        <div className="space-y-4">
          {pendingMembers.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mx-auto mb-3">
                <Check className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-foreground">All caught up!</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                There are no pending membership requests waiting for review at this time.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingMembers.map((m) => (
                <Card key={m.id} className="p-4 border-amber-500/20 bg-card/90 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={m.name} photoUrl={m.photoUrl} size={42} />
                        <div>
                          <div className="font-semibold text-sm text-foreground">{m.name}</div>
                          <div className="text-xs text-muted-foreground">{m.email || m.mobile || "No email"}</div>
                        </div>
                      </div>
                      <Badge tone="warning" className="text-[10px]">PENDING</Badge>
                    </div>
                    <div className="mt-3 text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      Requested on {new Date(m.joinedAt).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-border/50">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleApproval(m.id, false)}
                      disabled={actingId === m.id}
                      className="text-xs text-destructive hover:bg-destructive/10"
                    >
                      <X className="h-3.5 w-3.5 mr-1" />
                      Reject
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => void handleApproval(m.id, true)}
                      disabled={actingId === m.id}
                      className="text-xs"
                    >
                      {actingId === m.id ? (
                        <Spinner className="h-3.5 w-3.5 mr-1" />
                      ) : (
                        <Check className="h-3.5 w-3.5 mr-1" />
                      )}
                      Approve Membership
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Active Roster & Roles */
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by member name or email..."
                  className="pl-9.5"
                />
              </div>
              <div className="w-full sm:w-44">
                <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                  <option value="">All Roles</option>
                  <option value="OWNER">OWNER</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="COACH">COACH</option>
                  <option value="PLAYER">PLAYER</option>
                </Select>
              </div>
            </div>
          </Card>

          <Table head={["Member", "Contact", "Current Role", "Assign Role", "Joined"]}>
            {filteredActive.map((m) => (
              <tr key={m.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                <Td>
                  <div className="flex items-center gap-3">
                    <Avatar name={m.name} photoUrl={m.photoUrl} size={36} />
                    <div>
                      <div className="font-semibold text-sm text-foreground">{m.name}</div>
                      <div className="text-[11px] text-muted-foreground font-mono">{m.userId}</div>
                    </div>
                  </div>
                </Td>
                <Td className="text-xs">
                  <div className="text-foreground">{m.email || "—"}</div>
                  <div className="text-muted-foreground font-mono">{m.mobile || "—"}</div>
                </Td>
                <Td>
                  <Badge
                    tone={
                      m.role === "OWNER"
                        ? "accent"
                        : m.role === "ADMIN"
                        ? "primary"
                        : m.role === "COACH"
                        ? "warning"
                        : "muted"
                    }
                  >
                    {m.role}
                  </Badge>
                </Td>
                <Td>
                  <div className="w-36">
                    <Select
                      value={m.role}
                      disabled={actingId === m.id || m.role === "OWNER" || (!isClubOwner && m.role === "ADMIN")}
                      onChange={(e) => void handleRoleChange(m.id, e.target.value as any)}
                      className="h-8 text-xs py-1"
                    >
                      <option value="OWNER" disabled={!isClubOwner}>OWNER {!isClubOwner ? "(Owner only)" : ""}</option>
                      <option value="ADMIN" disabled={!isClubOwner}>ADMIN {!isClubOwner ? "(Owner only)" : ""}</option>
                      <option value="COACH">COACH</option>
                      <option value="PLAYER">PLAYER</option>
                    </Select>
                  </div>
                </Td>
                <Td className="text-xs text-muted-foreground font-mono">
                  {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : "—"}
                </Td>
              </tr>
            ))}
          </Table>
        </div>
      )}
    </div>
  );
}

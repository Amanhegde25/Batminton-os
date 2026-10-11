"use client";

import { useParams } from "next/navigation";
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
  Shield,
  Trash,
  RefreshCw,
  Crown
} from "@/components/icons";

interface GroupMemberRecord {
  id: string;
  groupId: string;
  userId: string;
  role: "LEADER" | "ADMIN" | "MEMBER";
  status: string;
  joinedAt: string;
  user: {
    id: string;
    name: string;
    email: string | null;
    mobile: string | null;
    photoUrl: string | null;
    skillLevel: string | null;
  } | null;
}

export default function GroupAdminMembersPage() {
  const params = useParams();
  const id = params?.id as string;
  const { me } = useSession();

  const [members, setMembers] = useState<GroupMemberRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [confirmModal, setConfirmModal] = useState<{
    type: "role";
    member: GroupMemberRecord;
    targetRole: "LEADER" | "ADMIN" | "MEMBER";
  } | {
    type: "remove";
    member: GroupMemberRecord;
  } | null>(null);
  const [selectedRole, setSelectedRole] = useState<"LEADER" | "ADMIN" | "MEMBER">("MEMBER");
  const [submitting, setSubmitting] = useState(false);
  const { toast, node } = useToast();

  const myMemberRecord = members.find((m) => m.userId === me?.id);
  const isGroupOwner = myMemberRecord?.role === "LEADER" || me?.role === "SUPER_ADMIN";

  async function loadMembers() {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api<GroupMemberRecord[]>(`/groups/${id}/members`);
      setMembers(res);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to load group members", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMembers();
  }, [id]);

  async function executeAction() {
    if (!confirmModal || !id) return;
    setSubmitting(true);

    try {
      if (confirmModal.type === "role") {
        await api(`/groups/${id}/members/${confirmModal.member.userId}`, {
          method: "PATCH",
          json: { role: confirmModal.targetRole }
        });
        toast(`Member role updated to ${confirmModal.targetRole}`, "success");
      } else if (confirmModal.type === "remove") {
        await api(`/groups/${id}/members/${confirmModal.member.userId}`, {
          method: "DELETE"
        });
        toast("Member removed from group", "success");
      }
      setConfirmModal(null);
      void loadMembers();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Action failed", "error");
    } finally {
      setSubmitting(false);
    }
  }

  const filteredMembers = members.filter((m) => {
    if (!search) return true;
    const name = m.user?.name?.toLowerCase() || "";
    const email = m.user?.email?.toLowerCase() || "";
    return name.includes(search.toLowerCase()) || email.includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6">
      {node}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Roster Management & Leadership</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Designate group co-leaders and manage player memberships in your PlayGroup squad.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadMembers()} className="gap-1.5 shrink-0">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search squad members..."
            className="pl-9.5"
          />
        </div>
      </Card>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner className="h-8 w-8 text-primary" />
        </div>
      ) : (
        <Table head={["Player", "Skill Level", "Role", "Joined", "Actions"]}>
          {filteredMembers.map((m) => {
            const isMe = m.userId === me?.id;
            const isLeader = m.role === "LEADER";

            return (
              <tr key={m.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                <Td>
                  <div className="flex items-center gap-3">
                    <Avatar name={m.user?.name || "Player"} photoUrl={m.user?.photoUrl} size={36} />
                    <div>
                      <div className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                        {m.user?.name || "Unnamed Player"}
                        {isMe && <span className="text-[11px] text-muted-foreground">(you)</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">{m.user?.email || m.user?.mobile || "—"}</div>
                    </div>
                  </div>
                </Td>
                <Td>
                  <Badge tone="muted" className="text-[10px]">
                    {m.user?.skillLevel || "Not set"}
                  </Badge>
                </Td>
                <Td>
                  <Badge
                    tone={m.role === "LEADER" ? "warning" : m.role === "ADMIN" ? "primary" : "muted"}
                    className="gap-1"
                  >
                    {m.role === "LEADER" ? (
                      <>
                        <Crown className="h-3 w-3" />
                        Leader
                      </>
                    ) : m.role === "ADMIN" ? (
                      <>
                        <Shield className="h-3 w-3" />
                        Admin
                      </>
                    ) : (
                      "Player"
                    )}
                  </Badge>
                </Td>
                <Td className="text-xs text-muted-foreground font-mono">
                  {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : "—"}
                </Td>
                <Td>
                  {!isMe && (
                    <div className="flex items-center gap-1.5">
                      {isGroupOwner ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedRole(m.role === "MEMBER" ? "ADMIN" : m.role === "ADMIN" ? "LEADER" : "MEMBER");
                            setConfirmModal({
                              type: "role",
                              member: m,
                              targetRole: m.role === "MEMBER" ? "ADMIN" : "MEMBER"
                            });
                          }}
                          className="h-8 px-2.5 text-xs"
                        >
                          Change Role
                        </Button>
                      ) : (
                        <span className="text-[11px] text-muted-foreground italic px-1">
                          Role locked
                        </span>
                      )}
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setConfirmModal({ type: "remove", member: m })}
                        className="h-8 w-8 p-0"
                        title="Remove member"
                      >
                        <Trash className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </Td>
              </tr>
            );
          })}
        </Table>
      )}

      {/* Confirmation Dialog */}
      {confirmModal && (
        <Dialog
          open={!!confirmModal}
          onClose={() => !submitting && setConfirmModal(null)}
          title={confirmModal.type === "role" ? "Change Squad Role" : "Remove Member from Squad"}
        >
          <div className="space-y-4">
            {confirmModal.type === "role" ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Select a new squad role for <strong>{confirmModal.member.user?.name}</strong>:
                </p>
                <Select
                  value={confirmModal.targetRole}
                  onChange={(e) =>
                    setConfirmModal({
                      ...confirmModal,
                      targetRole: e.target.value as any
                    })
                  }
                  className="w-full text-xs"
                >
                  <option value="MEMBER">Player / Member (Regular Squad Player)</option>
                  <option value="ADMIN">Group Admin (Can schedule sessions & moderate posts)</option>
                  <option value="LEADER">Group Leader / Co-Owner (Full group management)</option>
                </Select>
                <p className="text-xs text-muted-foreground">
                  * Note: Only group owners have the authority to appoint group admins or modify squad permissions.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Are you sure you want to remove <strong>{confirmModal.member.user?.name}</strong> from this PlayGroup?
                They will lose access to member discussions and RSVP privileges.
              </p>
            )}
            <div className="flex justify-end gap-3 pt-3 border-t">
              <Button variant="outline" onClick={() => setConfirmModal(null)} disabled={submitting}>
                Cancel
              </Button>
              <Button
                variant={confirmModal.type === "remove" ? "destructive" : "default"}
                onClick={() => void executeAction()}
                disabled={submitting}
                className="gap-2"
              >
                {submitting && <Spinner className="h-3.5 w-3.5" />}
                Confirm Action
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

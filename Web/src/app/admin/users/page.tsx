"use client";

import { useEffect, useState, useTransition } from "react";
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
  ShieldAlert,
  Trash,
  RefreshCw,
  Lock,
  Unlock,
  ChevronLeft,
  ChevronRight
} from "@/components/icons";

interface PlatformUser {
  id: string;
  name: string;
  email: string | null;
  mobile: string | null;
  role: string;
  suspended?: boolean;
  clubCount: number;
  photoUrl: string | null;
  createdAt: string;
}

interface UserListResponse {
  items: PlatformUser[];
  total: number;
  page: number;
  pageSize: number;
}

export default function AdminUsersPage() {
  const [data, setData] = useState<UserListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  const { toast, node } = useToast();

  // Dialog states
  const [confirmModal, setConfirmModal] = useState<{
    type: "role" | "suspend" | "delete";
    user: PlatformUser;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  async function loadUsers(targetPage = page, searchTerm = search, role = roleFilter) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(targetPage));
      if (searchTerm) params.set("search", searchTerm);
      if (role) params.set("role", role);

      const res = await api<UserListResponse>(`/platform/users?${params.toString()}`);
      setData(res);
      setPage(res.page);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to load users", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers(1, search, roleFilter);
  }, [roleFilter]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    void loadUsers(1, search, roleFilter);
  }

  async function executeAction() {
    if (!confirmModal) return;
    const { type, user } = confirmModal;
    setActionLoading(true);

    try {
      if (type === "role") {
        const nextRole = user.role === "SUPER_ADMIN" ? "PLAYER" : "SUPER_ADMIN";
        await api(`/platform/users/${user.id}`, {
          method: "PATCH",
          json: { role: nextRole }
        });
        toast(`User role updated to ${nextRole}`, "success");
      } else if (type === "suspend") {
        await api(`/platform/users/${user.id}`, {
          method: "PATCH",
          json: { action: "suspend" }
        });
        toast(`User ${user.suspended ? "unsuspended" : "suspended"} successfully`, "success");
      } else if (type === "delete") {
        await api(`/platform/users/${user.id}`, {
          method: "DELETE"
        });
        toast("User account soft-deleted", "success");
      }
      setConfirmModal(null);
      void loadUsers(page, search, roleFilter);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Action failed", "error");
    } finally {
      setActionLoading(false);
    }
  }

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {node}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Platform Users</h1>
            {data && <Badge tone="muted" className="font-mono">{data.total} registered</Badge>}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Audit user accounts, assign Super Admin credentials, manage suspensions, and inspect club associations.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadUsers(page, search, roleFilter)}
          disabled={loading}
          className="gap-2 shrink-0"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Search and Filters */}
      <Card className="p-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, or mobile..."
              className="pl-9.5"
            />
          </div>
          <div className="w-full sm:w-48">
            <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="">All Roles</option>
              <option value="SUPER_ADMIN">SUPER_ADMIN</option>
              <option value="PLAYER">PLAYER</option>
            </Select>
          </div>
          <Button type="submit" variant="default" className="shrink-0">
            Search
          </Button>
          {(search || roleFilter) && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSearch("");
                setRoleFilter("");
                void loadUsers(1, "", "");
              }}
            >
              Reset
            </Button>
          )}
        </form>
      </Card>

      {/* Users Table */}
      <div className="space-y-4">
        {loading && !data ? (
          <div className="flex h-64 items-center justify-center">
            <Spinner className="h-8 w-8 text-primary" />
          </div>
        ) : (
          <>
            <Table head={["User", "Contact", "Role", "Status", "Clubs", "Registered", "Actions"]}>
              {data?.items.map((u) => {
                const isSuper = u.role === "SUPER_ADMIN";
                const isSuspended = !!u.suspended;

                return (
                  <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar name={u.name} photoUrl={u.photoUrl} size={36} />
                        <div>
                          <div className="font-semibold text-foreground text-sm">{u.name}</div>
                          <div className="text-[11px] text-muted-foreground font-mono">{u.id}</div>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <div className="text-xs">
                        <div className="text-foreground">{u.email || "—"}</div>
                        <div className="text-muted-foreground font-mono">{u.mobile || "—"}</div>
                      </div>
                    </Td>
                    <Td>
                      <Badge tone={isSuper ? "primary" : "muted"}>
                        {isSuper ? "SUPER ADMIN" : "PLAYER"}
                      </Badge>
                    </Td>
                    <Td>
                      {isSuspended ? (
                        <Badge tone="danger">SUSPENDED</Badge>
                      ) : (
                        <Badge tone="success">ACTIVE</Badge>
                      )}
                    </Td>
                    <Td className="font-mono text-xs tabular-nums">
                      {u.clubCount} {u.clubCount === 1 ? "club" : "clubs"}
                    </Td>
                    <Td className="text-xs text-muted-foreground font-mono">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                    </Td>
                    <Td>
                      <div className="flex items-center gap-1.5">
                        {/* Toggle role */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setConfirmModal({ type: "role", user: u })}
                          title={isSuper ? "Demote to PLAYER" : "Promote to SUPER_ADMIN"}
                          className="h-8 px-2.5 text-xs"
                        >
                          <Shield className="h-3.5 w-3.5 mr-1" />
                          {isSuper ? "Demote" : "Promote"}
                        </Button>

                        {/* Toggle suspend */}
                        {!isSuper && (
                          <Button
                            variant={isSuspended ? "outline" : "outline"}
                            size="sm"
                            onClick={() => setConfirmModal({ type: "suspend", user: u })}
                            title={isSuspended ? "Unsuspend account" : "Suspend account"}
                            className="h-8 px-2.5 text-xs"
                          >
                            {isSuspended ? (
                              <>
                                <Unlock className="h-3.5 w-3.5 mr-1 text-emerald-500" />
                                Unsuspend
                              </>
                            ) : (
                              <>
                                <Lock className="h-3.5 w-3.5 mr-1 text-amber-500" />
                                Suspend
                              </>
                            )}
                          </Button>
                        )}

                        {/* Soft Delete */}
                        {!isSuper && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setConfirmModal({ type: "delete", user: u })}
                            title="Delete user"
                            className="h-8 w-8 p-0"
                          >
                            <Trash className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </Table>

            {/* Pagination */}
            {data && data.total > data.pageSize && (
              <div className="flex items-center justify-between pt-2">
                <div className="text-xs text-muted-foreground">
                  Showing {(page - 1) * data.pageSize + 1} to {Math.min(page * data.pageSize, data.total)} of {data.total} users
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => void loadUsers(page - 1, search, roleFilter)}
                    className="gap-1 text-xs"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> Previous
                  </Button>
                  <span className="text-xs font-mono px-2">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => void loadUsers(page + 1, search, roleFilter)}
                    className="gap-1 text-xs"
                  >
                    Next <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmModal && (
        <Dialog
          open={!!confirmModal}
          onClose={() => !actionLoading && setConfirmModal(null)}
          title={
            confirmModal.type === "role"
              ? "Change User Role"
              : confirmModal.type === "suspend"
              ? confirmModal.user.suspended
                ? "Unsuspend User Account"
                : "Suspend User Account"
              : "Delete User Account"
          }
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {confirmModal.type === "role" && (
                <>
                  Are you sure you want to change the role of <strong>{confirmModal.user.name}</strong> to{" "}
                  <strong>{confirmModal.user.role === "SUPER_ADMIN" ? "PLAYER" : "SUPER_ADMIN"}</strong>?
                  {confirmModal.user.role !== "SUPER_ADMIN" && (
                    <span className="block mt-2 text-destructive font-medium">
                      Warning: Super admins have unrestricted access to all platform resources, clubs, and databases.
                    </span>
                  )}
                </>
              )}
              {confirmModal.type === "suspend" && (
                <>
                  {confirmModal.user.suspended ? (
                    <>Restore access for <strong>{confirmModal.user.name}</strong>? The user will be able to sign in and interact normally.</>
                  ) : (
                    <>Suspend access for <strong>{confirmModal.user.name}</strong>? The user will immediately be barred from active sessions.</>
                  )}
                </>
              )}
              {confirmModal.type === "delete" && (
                <>
                  Are you sure you want to soft-delete <strong>{confirmModal.user.name}</strong>? Their profile will be removed from all active club rosters.
                </>
              )}
            </p>

            <div className="flex justify-end gap-3 pt-3 border-t">
              <Button
                variant="outline"
                onClick={() => setConfirmModal(null)}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                variant={confirmModal.type === "delete" ? "destructive" : "default"}
                onClick={() => void executeAction()}
                disabled={actionLoading}
                className="gap-2"
              >
                {actionLoading && <Spinner className="h-3.5 w-3.5" />}
                Confirm Action
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

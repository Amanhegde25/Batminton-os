"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import {
  Badge,
  Button,
  Card,
  Dialog,
  Input,
  Spinner,
  Table,
  Td,
  useToast
} from "@/components/ui";
import {
  Handshake,
  Search,
  RefreshCw,
  Trash,
  ChevronLeft,
  ChevronRight,
  Lock,
  Unlock
} from "@/components/icons";

interface PlayGroupItem {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  skillLevel: string | null;
  isPublic: boolean;
  members: number;
  creator: { name: string; email: string | null } | null;
  createdAt: string;
}

interface GroupListResponse {
  items: PlayGroupItem[];
  total: number;
  page: number;
  pageSize: number;
}

export default function AdminGroupsPage() {
  const [data, setData] = useState<GroupListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { toast, node } = useToast();

  const [deleteModal, setDeleteModal] = useState<PlayGroupItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadGroups(targetPage = page, searchTerm = search) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(targetPage));
      if (searchTerm) params.set("search", searchTerm);

      const res = await api<GroupListResponse>(`/platform/groups?${params.toString()}`);
      setData(res);
      setPage(res.page);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to load groups", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadGroups(1, search);
  }, []);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    void loadGroups(1, search);
  }

  async function handleDeleteGroup() {
    if (!deleteModal) return;
    setSubmitting(true);
    try {
      await api(`/platform/groups/${deleteModal.id}`, {
        method: "DELETE"
      });
      toast(`PlayGroup "${deleteModal.name}" removed`, "success");
      setDeleteModal(null);
      void loadGroups(page, search);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to delete group", "error");
    } finally {
      setSubmitting(false);
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
            <h1 className="text-2xl font-bold tracking-tight">Platform PlayGroups</h1>
            {data && <Badge tone="muted" className="font-mono">{data.total} groups</Badge>}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Oversight of independent player communities, open sessions, and public discovery listings.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadGroups(page, search)}
          disabled={loading}
          className="gap-2 shrink-0"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Search Bar */}
      <Card className="p-4">
        <form onSubmit={handleSearchSubmit} className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by group name or city..."
              className="pl-9.5"
            />
          </div>
          <Button type="submit">Search</Button>
          {search && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSearch("");
                void loadGroups(1, "");
              }}
            >
              Reset
            </Button>
          )}
        </form>
      </Card>

      {/* Table */}
      {loading && !data ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner className="h-8 w-8 text-primary" />
        </div>
      ) : (
        <div className="space-y-4">
          <Table head={["Group", "City", "Skill Level", "Visibility", "Members", "Leader", "Created", "Actions"]}>
            {data?.items.map((g) => (
              <tr key={g.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                <Td>
                  <div>
                    <div className="font-semibold text-foreground text-sm">{g.name}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">/{g.slug}</div>
                  </div>
                </Td>
                <Td className="text-muted-foreground">{g.city ?? "—"}</Td>
                <Td>
                  <Badge tone="muted" className="capitalize">
                    {g.skillLevel ? g.skillLevel.toLowerCase() : "All Levels"}
                  </Badge>
                </Td>
                <Td>
                  {g.isPublic ? (
                    <Badge tone="success" className="gap-1">
                      <Unlock className="h-3 w-3" /> Public
                    </Badge>
                  ) : (
                    <Badge tone="muted" className="gap-1">
                      <Lock className="h-3 w-3" /> Private
                    </Badge>
                  )}
                </Td>
                <Td className="font-mono tabular-nums">{g.members}</Td>
                <Td>
                  {g.creator ? (
                    <div>
                      <div className="text-xs font-medium text-foreground">{g.creator.name}</div>
                      <div className="text-[10px] text-muted-foreground">{g.creator.email}</div>
                    </div>
                  ) : (
                    "—"
                  )}
                </Td>
                <Td className="text-xs text-muted-foreground font-mono">
                  {g.createdAt ? new Date(g.createdAt).toLocaleDateString() : "—"}
                </Td>
                <Td>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteModal(g)}
                    className="h-8 w-8 p-0"
                    title="Delete PlayGroup"
                  >
                    <Trash className="h-3.5 w-3.5" />
                  </Button>
                </Td>
              </tr>
            ))}
          </Table>

          {/* Pagination */}
          {data && data.total > data.pageSize && (
            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-muted-foreground">
                Showing {(page - 1) * data.pageSize + 1} to {Math.min(page * data.pageSize, data.total)} of {data.total} groups
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => void loadGroups(page - 1, search)}
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
                  onClick={() => void loadGroups(page + 1, search)}
                  className="gap-1 text-xs"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Modal */}
      {deleteModal && (
        <Dialog
          open={!!deleteModal}
          onClose={() => !submitting && setDeleteModal(null)}
          title="Delete PlayGroup"
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to soft-delete <strong>{deleteModal.name}</strong>?
              This will remove the group from discovery listings and cancel scheduled sessions.
            </p>
            <div className="flex justify-end gap-3 pt-3 border-t">
              <Button variant="outline" onClick={() => setDeleteModal(null)} disabled={submitting}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => void handleDeleteGroup()} disabled={submitting} className="gap-2">
                {submitting && <Spinner className="h-3.5 w-3.5" />}
                Delete PlayGroup
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

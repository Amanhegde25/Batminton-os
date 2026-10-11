"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import {
  Badge,
  Button,
  Card,
  Dialog,
  Spinner,
  Table,
  Td,
  useToast
} from "@/components/ui";
import {
  Scale,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Clock
} from "@/components/icons";

interface AuditItem {
  id: string;
  action: string;
  actorUserId: string | null;
  actor?: { name: string; email: string | null } | null;
  clubId?: string | null;
  entityType?: string;
  entityId?: string;
  previousValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  meta?: Record<string, unknown> | null;
  createdAt: string;
}

interface AuditResponse {
  items: AuditItem[];
  total: number;
  page: number;
  pageSize: number;
}

export default function AdminAuditPage() {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [inspectItem, setInspectItem] = useState<AuditItem | null>(null);
  const { toast, node } = useToast();

  async function loadAudit(targetPage = page) {
    setLoading(true);
    try {
      const res = await api<AuditResponse>(`/platform/audit?page=${targetPage}&pageSize=50`);
      setData(res);
      setPage(res.page);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to load audit records", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAudit(1);
  }, []);

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {node}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Platform Audit Log</h1>
            {data && <Badge tone="muted" className="font-mono">{data.total} recorded events</Badge>}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Immutable cross-tenant audit trail tracking all administrative actions, plan switches, suspensions, and role escalations.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadAudit(page)}
          disabled={loading}
          className="gap-2 shrink-0"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Table */}
      {loading && !data ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner className="h-8 w-8 text-primary" />
        </div>
      ) : (
        <div className="space-y-4">
          <Table head={["Timestamp", "Action", "Actor", "Entity", "Club", "Details"]}>
            {data?.items.map((entry) => {
              const isDestructive =
                entry.action.includes("deleted") ||
                entry.action.includes("suspended") ||
                entry.action.includes("blocked");
              const isPlan = entry.action.includes("plan");

              return (
                <tr key={entry.id || Math.random().toString()} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <Td className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3 shrink-0" />
                      {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : "—"}
                    </div>
                  </Td>
                  <Td>
                    <Badge
                      tone={isDestructive ? "danger" : isPlan ? "warning" : "muted"}
                      className="font-mono text-[11px]"
                    >
                      {entry.action}
                    </Badge>
                  </Td>
                  <Td>
                    {entry.actor ? (
                      <div>
                        <div className="text-xs font-medium text-foreground">{entry.actor.name}</div>
                        <div className="text-[10px] text-muted-foreground">{entry.actor.email}</div>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground font-mono">
                        {entry.actorUserId ? entry.actorUserId.slice(0, 8) + "…" : "system"}
                      </span>
                    )}
                  </Td>
                  <Td className="text-xs">
                    {entry.entityType ? (
                      <div>
                        <span className="font-semibold text-foreground">{entry.entityType}</span>
                        {entry.entityId && (
                          <div className="text-[10px] text-muted-foreground font-mono">{entry.entityId}</div>
                        )}
                      </div>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td className="text-xs font-mono text-muted-foreground">
                    {entry.clubId ? entry.clubId.slice(0, 8) + "…" : "platform"}
                  </Td>
                  <Td>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setInspectItem(entry)}
                      className="h-7 px-2 text-xs"
                    >
                      Inspect
                    </Button>
                  </Td>
                </tr>
              );
            })}
          </Table>

            {/* Pagination */}
            {data && data.total > data.pageSize && (
              <div className="flex items-center justify-between pt-2">
                <div className="text-xs text-muted-foreground">
                  Showing {(page - 1) * data.pageSize + 1} to {Math.min(page * data.pageSize, data.total)} of {data.total} records
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => void loadAudit(page - 1)}
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
                    onClick={() => void loadAudit(page + 1)}
                    className="gap-1 text-xs"
                  >
                    Next <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

      {/* Inspect Item Modal */}
      {inspectItem && (
        <Dialog
          open={!!inspectItem}
          onClose={() => setInspectItem(null)}
          title={`Audit Event: ${inspectItem.action}`}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-xs bg-muted/40 p-3 rounded-xl border">
              <div>
                <span className="text-muted-foreground">Recorded:</span>
                <div className="font-medium font-mono">{new Date(inspectItem.createdAt).toLocaleString()}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Action:</span>
                <div className="font-semibold text-primary">{inspectItem.action}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Entity:</span>
                <div className="font-medium">{inspectItem.entityType} ({inspectItem.entityId || "N/A"})</div>
              </div>
              <div>
                <span className="text-muted-foreground">Club Scope:</span>
                <div className="font-mono">{inspectItem.clubId || "Global Platform"}</div>
              </div>
            </div>

            {inspectItem.previousValue && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Previous State
                </div>
                <pre className="text-xs bg-muted/60 p-3 rounded-xl overflow-x-auto font-mono text-muted-foreground">
                  {JSON.stringify(inspectItem.previousValue, null, 2)}
                </pre>
              </div>
            )}

            {inspectItem.newValue && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  New State
                </div>
                <pre className="text-xs bg-muted/60 p-3 rounded-xl overflow-x-auto font-mono text-foreground">
                  {JSON.stringify(inspectItem.newValue, null, 2)}
                </pre>
              </div>
            )}

            {inspectItem.meta && Object.keys(inspectItem.meta).length > 0 && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Metadata
                </div>
                <pre className="text-xs bg-muted/60 p-3 rounded-xl overflow-x-auto font-mono text-muted-foreground">
                  {JSON.stringify(inspectItem.meta, null, 2)}
                </pre>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t">
              <Button variant="outline" onClick={() => setInspectItem(null)}>
                Close
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

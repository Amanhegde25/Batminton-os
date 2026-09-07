"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Badge, Button, Card, EmptyState, Spinner, Tabs, useToast } from "@/components/ui";
import { Bell, CheckCheck } from "@/components/icons";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
}

const TYPE_TONE: Record<string, "primary" | "success" | "warning" | "danger" | "muted"> = {
  MATCH_CREATED: "primary",
  MATCH_RESULT: "success",
  BOOKING_CONFIRMED: "success",
  BOOKING_CANCELLED: "danger",
  ATTENDANCE_REMINDER: "warning",
  PAYMENT_DUE: "warning",
  PENALTY_ADDED: "danger",
  TOURNAMENT_ANNOUNCED: "primary",
  TOURNAMENT_RESULT: "success",
  MEMBERSHIP_APPROVED: "success",
  WALLET_ADJUSTED: "muted",
  PLAN_CHANGED: "muted"
};

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [tab, setTab] = useState<"ALL" | "UNREAD">("ALL");
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const { toast, node } = useToast();

  const load = useCallback(async () => {
    try {
      const data = await api<{ items: NotificationItem[]; unread: number }>("/notifications");
      setItems(data.items ?? []);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to load notifications", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function markAll() {
    setMarking(true);
    try {
      await api("/notifications", { method: "POST", json: {} });
      toast("All notifications marked as read");
      void load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to mark notifications", "error");
    } finally {
      setMarking(false);
    }
  }

  async function markSingle(id: string) {
    try {
      await api("/notifications", { method: "POST", json: { ids: [id] } });
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, readAt: new Date().toISOString() } : item))
      );
    } catch {}
  }

  const filtered = tab === "UNREAD" ? items.filter((n) => !n.readAt) : items;
  const unreadCount = items.filter((n) => !n.readAt).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {node}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold">
            <Bell className="h-6 w-6 text-primary" /> Notifications
          </h1>
          <p className="text-sm text-muted-foreground">
            Stay updated with matches, wallet activity, penalties, and club announcements.
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={markAll}
            disabled={marking}
            className="inline-flex items-center gap-1.5"
          >
            <CheckCheck className="h-4 w-4" />
            {marking ? "Marking…" : "Mark all as read"}
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <Tabs
          tabs={[
            { key: "ALL", label: `All (${items.length})` },
            { key: "UNREAD", label: `Unread (${unreadCount})` }
          ]}
          active={tab}
          onChange={(key) => setTab(key as "ALL" | "UNREAD")}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-8 w-8 text-muted-foreground/70" />}
          title={tab === "UNREAD" ? "No unread notifications" : "You're all caught up"}
          body={
            tab === "UNREAD"
              ? "All your notifications have been marked as read."
              : "When you receive match updates, booking confirmations, or club notices, they will appear here."
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((n) => {
            const isUnread = !n.readAt;
            return (
              <Card
                key={n.id}
                onClick={() => isUnread && markSingle(n.id)}
                className={`p-4 transition-all duration-150 ${
                  isUnread
                    ? "border-primary/40 bg-primary/[0.03] shadow-sm hover:border-primary/60 cursor-pointer"
                    : "hover:bg-muted/30"
                }`}
              >
                <div className="flex items-start justify-between gap-3 min-w-0">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold break-words">{n.title}</span>
                      {n.type && (
                        <Badge tone={TYPE_TONE[n.type] ?? "muted"} className="text-[10px]">
                          {n.type.replace(/_/g, " ").toLowerCase()}
                        </Badge>
                      )}
                      {isUnread && (
                        <span className="inline-flex items-center rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-semibold text-primary-foreground">
                          New
                        </span>
                      )}
                    </div>
                    {n.body && (
                      <p className="text-xs text-muted-foreground leading-relaxed break-words">
                        {n.body}
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground/80 pt-1">
                      {new Date(n.createdAt).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short"
                      })}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useSession } from "@/components/session";
import { api } from "@/lib/client";
import {
  Badge,
  Button,
  Card,
  Dialog,
  Field,
  Input,
  Spinner,
  Textarea,
  useToast
} from "@/components/ui";
import {
  MessageSquare,
  Bell,
  CheckCircle2,
  Users,
  Shield
} from "@/components/icons";

export default function ClubAdminAnnouncementsPage() {
  const { activeClubId, activeMembership } = useSession();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [lastDelivered, setLastDelivered] = useState<number | null>(null);
  const { toast, node } = useToast();

  async function handleSend() {
    if (!activeClubId || !title.trim() || !body.trim()) return;
    setSending(true);
    try {
      const res = await api<{ delivered: number }>(`/clubs/${activeClubId}/admin/announcements`, {
        method: "POST",
        json: { title: title.trim(), body: body.trim() }
      });
      setLastDelivered(res.delivered);
      toast(`Broadcast sent to ${res.delivered} members!`, "success");
      setTitle("");
      setBody("");
      setConfirmOpen(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to broadcast announcement", "error");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {node}

      <div>
        <h2 className="text-lg font-semibold tracking-tight">Broadcast Member Announcement</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Push notifications and alerts directly into the notification center of every active member in{" "}
          <strong>{activeMembership?.club.name}</strong>.
        </p>
      </div>

      {lastDelivered !== null && (
        <Card className="p-4 border-emerald-500/30 bg-emerald-500/10 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <div className="text-xs">
            <span className="font-semibold text-foreground">Announcement delivered successfully!</span>
            <span className="text-muted-foreground ml-1">
              Dispatched to {lastDelivered} registered active club members.
            </span>
          </div>
        </Card>
      )}

      {/* Composer Form */}
      <Card className="p-6 space-y-4">
        <Field label="Announcement Title" hint="Clear and concise (e.g., 'Court Maintenance Schedule this Sunday')">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Club Tournament Registration Open!"
            maxLength={120}
          />
        </Field>

        <Field label="Message Details" hint="Include dates, times, requirements, or relevant links">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your announcement message here..."
            rows={5}
            maxLength={1000}
          />
        </Field>

        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Bell className="h-3.5 w-3.5 text-primary" />
            <span>Will notify all ACTIVE members</span>
          </div>
          <Button
            type="button"
            disabled={!title.trim() || !body.trim()}
            onClick={() => setConfirmOpen(true)}
            className="gap-2"
          >
            <MessageSquare className="h-4 w-4" />
            Send Broadcast
          </Button>
        </div>
      </Card>

      {/* Confirmation Dialog */}
      {confirmOpen && (
        <Dialog
          open={confirmOpen}
          onClose={() => !sending && setConfirmOpen(false)}
          title="Confirm Member Broadcast"
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to broadcast this message? It will immediately deliver to every active member's notification inbox.
            </p>

            <div className="p-3.5 rounded-xl border bg-muted/40 space-y-1.5 text-xs">
              <div className="font-semibold text-foreground">{title}</div>
              <div className="text-muted-foreground whitespace-pre-wrap">{body}</div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t">
              <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={sending}>
                Cancel
              </Button>
              <Button onClick={() => void handleSend()} disabled={sending} className="gap-2">
                {sending && <Spinner className="h-3.5 w-3.5" />}
                Confirm & Dispatch
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

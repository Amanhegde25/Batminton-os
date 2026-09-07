"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "@/components/session";
import { api } from "@/lib/client";
import { Badge, Button, Card, Field, Input, Select, Spinner } from "@/components/ui";
import { Dialog, useToast } from "@/components/ui";

interface TournamentRow {
  id: string;
  name: string;
  size: number;
  status: string;
  fee: number;
  _count?: { participants: number };
}

function TournamentsInner() {
  const { activeClubId, activeMembership } = useSession();
  const [rows, setRows] = useState<TournamentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const { toast, node } = useToast();

  const isStaff = ["OWNER", "ADMIN"].includes(activeMembership?.role ?? "");

  async function load() {
    if (!activeClubId) return;
    setLoading(true);
    try {
      setRows(await api<TournamentRow[]>(`/clubs/${activeClubId}/tournaments`));
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClubId]);

  return (
    <div className="space-y-4">
      {node}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tournaments</h1>
        {isStaff && <Button onClick={() => setCreateOpen(true)}>+ New tournament</Button>}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((t) => (
            <Link key={t.id} href={`/app/tournaments/${t.id}`}>
              <Card className="h-full p-5 transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{t.name}</p>
                  <Badge
                    tone={t.status === "ONGOING" ? "danger" : t.status === "COMPLETED" ? "success" : t.status === "REGISTRATION" ? "primary" : "muted"}
                  >
                    {t.status.toLowerCase()}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Knockout · {t.size} players{t.fee > 0 ? ` · entry ₹${(t.fee / 100).toLocaleString("en-IN")}` : " · free"}
                </p>
                {t._count && <p className="text-xs text-muted-foreground">{t._count.participants} registered</p>}
              </Card>
            </Link>
          ))}
          {!loading && rows.length === 0 && (
            <Card className="col-span-full p-10 text-center text-sm text-muted-foreground">
              No tournaments yet.
            </Card>
          )}
        </div>
      )}

      <CreateDialog open={createOpen} onClose={() => setCreateOpen(false)} clubId={activeClubId ?? ""} onCreated={() => void load()} />
    </div>
  );
}

function CreateDialog({
  open,
  onClose,
  clubId,
  onCreated
}: {
  open: boolean;
  onClose: () => void;
  clubId: string;
  onCreated: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onClose={onClose} title="Create knockout tournament">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
          try {
            await api(`/clubs/${clubId}/tournaments`, {
              method: "POST",
              json: { name: f.name, size: Number(f.size), fee: Math.round(Number(f.fee || 0) * 100) }
            });
            onClose();
            onCreated();
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Name">
          <Input name="name" required placeholder="Monsoon Smash Cup" minLength={3} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Bracket size">
            <Select name="size" defaultValue="8">
              {[4, 8, 16, 32].map((n) => (
                <option key={n} value={n}>
                  {n} players
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Entry fee ₹" hint="Charged to wallet on registration.">
            <Input name="fee" type="number" min={0} step="any" defaultValue={0} />
          </Field>
        </div>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Creating…" : "Create tournament"}
        </Button>
      </form>
    </Dialog>
  );
}

export default function TournamentsPage() {
  return <TournamentsInner />;
}

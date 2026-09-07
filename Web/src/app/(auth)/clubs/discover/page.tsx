"use client";

import { useEffect, useState } from "react";
import { SessionProvider } from "@/components/session";
import { api } from "@/lib/client";
import { Badge, Button, Input, Spinner } from "@/components/ui";
import { useToast } from "@/components/ui";

interface PublicClub {
  id: string;
  name: string;
  city: string | null;
  description: string | null;
  logoUrl: string | null;
  subscriptionPlan: string;
  memberCount: number;
  membership?: { id: string; status: string; role: string } | null;
}

function DiscoverInner() {
  const [q, setQ] = useState("");
  const [clubs, setClubs] = useState<PublicClub[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast, node } = useToast();

  async function load(query = "") {
    setLoading(true);
    try {
      setClubs(await api<PublicClub[]>(`/clubs?q=${encodeURIComponent(query)}`));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function join(clubId: string) {
    try {
      await api(`/clubs/${clubId}/join`, { method: "POST" });
      toast("Join request sent — waiting for approval.");
      void load(q);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not request to join", "error");
    }
  }

  return (
    <main className="container-page py-10">
      {node}
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold">Discover clubs</h1>
        <p className="mt-1 text-sm text-muted-foreground">Find a club near you and request to join.</p>
        <form
          className="mt-5 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void load(q);
          }}
        >
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or city…" />
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>

        <div className="mt-6 space-y-3">
          {loading ? (
            <div className="flex justify-center py-12">
              <Spinner className="h-6 w-6" />
            </div>
          ) : clubs.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No clubs found.</p>
          ) : (
            clubs.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-4 rounded-xl border bg-card p-4">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-semibold">
                    {c.name} <Badge tone="accent">{c.subscriptionPlan}</Badge>
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {[c.city, c.description].filter(Boolean).join(" · ")}
                  </p>
                  <p className="text-xs text-muted-foreground">{c.memberCount} members</p>
                </div>
                {c.membership ? (
                  c.membership.status === "ACTIVE" ? (
                    <Badge tone="success">Member</Badge>
                  ) : (
                    <Badge tone="warning">Pending approval</Badge>
                  )
                ) : (
                  <Button size="sm" onClick={() => join(c.id)}>
                    Request to join
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}

export default function DiscoverPage() {
  return (
    <SessionProvider>
      <DiscoverInner />
    </SessionProvider>
  );
}

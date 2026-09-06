"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SessionProvider } from "@/components/session";
import { api } from "@/lib/client";
import { Badge, Button, Card, Select, Spinner, StatCard } from "@/components/ui";
import { Table, Td, useToast } from "@/components/ui";

interface PlatformData {
  totals: { clubs: number; users: number; matches: number; activeMembers: number };
  clubs: {
    id: string;
    name: string;
    city: string | null;
    subscriptionPlan: string;
    memberCount: number;
    matchCount: number;
    ownerName: string;
    createdAt: string;
  }[];
}

function AdminInner() {
  const [data, setData] = useState<PlatformData | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const { toast, node } = useToast();

  async function load() {
    try {
      setData(await api<PlatformData>("/platform/overview"));
      setDenied(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("admin") || msg.includes("permission")) setDenied(true);
      else toast(msg || "Failed to load", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function changePlan(clubId: string, plan: string) {
    try {
      await api(`/platform/clubs/${clubId}/plan`, { method: "PATCH", json: { plan } });
      toast(`Plan changed to ${plan}`);
      void load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Change failed", "error");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (denied) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
        <p className="text-4xl">🛡️</p>
        <h1 className="text-xl font-semibold">Platform admin access required</h1>
        <p className="text-sm text-muted-foreground">Sign in as the super admin account to view this page.</p>
        <Link href="/login">
          <Button variant="outline">Go to login</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container-page space-y-6 py-8">
      {node}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/app" className="text-sm text-primary hover:underline">
            ← Back to app
          </Link>
          <h1 className="text-2xl font-bold">🛡️ Platform admin</h1>
        </div>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Clubs" value={data.totals.clubs} />
            <StatCard label="Users" value={data.totals.users} />
            <StatCard label="Matches played" value={data.totals.matches} />
            <StatCard label="Active memberships" value={data.totals.activeMembers} />
          </div>

          <Table head={["Club", "City", "Owner", "Members", "Matches", "Plan"]}>
            {data.clubs.map((c) => (
              <tr key={c.id} className="border-b last:border-0">
                <Td className="font-medium">{c.name}</Td>
                <Td>{c.city ?? "—"}</Td>
                <Td>{c.ownerName}</Td>
                <Td className="tabular-nums">{c.memberCount}</Td>
                <Td className="tabular-nums">{c.matchCount}</Td>
                <Td>
                  <Select
                    value={c.subscriptionPlan}
                    onChange={(e) => changePlan(c.id, e.target.value)}
                    className="h-8 w-32 text-xs"
                  >
                    {["FREE", "PRO", "PREMIUM"].map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </Select>
                </Td>
              </tr>
            ))}
          </Table>

          <Card className="p-5 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Billing is mocked.</p>
            Plan changes take effect immediately — feature gates are enforced by <Badge tone="primary">assertFeature</Badge> on
            every API route.
          </Card>
        </>
      )}
    </div>
  );
}

export default function AdminPage() {
  return (
    <SessionProvider>
      <AdminInner />
    </SessionProvider>
  );
}

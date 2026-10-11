"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { SessionProvider, useSession } from "@/components/session";
import { api } from "@/lib/client";
import { Button, Field, Input, Select, Spinner, Card } from "@/components/ui";
import { Shield, ArrowLeft, Building2 } from "@/components/icons";

function CreateClubForm() {
  const router = useRouter();
  const { me, loading: sessionLoading } = useSession();
  const [form, setForm] = useState({
    name: "",
    city: "",
    description: "",
    ownerId: "",
    lat: "",
    lng: ""
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (sessionLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  if (!me || me.role !== "SUPER_ADMIN") {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-10">
        <Card className="w-full max-w-md p-6 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive border border-destructive/20">
            <Shield className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Club Creation Restricted</h1>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              Only platform <strong>Super Administrators</strong> can register new clubs on Badminton Club OS.
              Existing club owners and managers can modify club details, description, and manage member roles within their respective clubs.
            </p>
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <Link href="/clubs/discover">
              <Button className="w-full text-xs">Browse Available Clubs</Button>
            </Link>
            <Link href="/app">
              <Button variant="outline" className="w-full text-xs">
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </Card>
      </main>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const club = await api<{ id: string }>("/clubs", {
        method: "POST",
        json: {
          name: form.name,
          city: form.city || undefined,
          description: form.description || undefined,
          ownerId: form.ownerId.trim() || undefined,
          lat: form.lat ? Number(form.lat) : undefined,
          lng: form.lng ? Number(form.lng) : undefined
        }
      });
      try {
        localStorage.setItem("bcos-active-club", club.id);
      } catch {}
      router.push("/app");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create club");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="flex items-center gap-2 mb-2">
          <Link href="/admin/clubs" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ArrowLeft className="h-3 w-3" /> Back to Platform Clubs
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Create Club (Super Admin)</h1>
            <p className="text-xs text-muted-foreground">
              Provision a new club tenant. Penalty rules and settings will be pre-configured.
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
          <Field label="Club name">
            <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Smash Arena" />
          </Field>
          <Field label="Assign Owner User ID" hint="Optional user ID. If empty, you will be set as the initial Owner.">
            <Input value={form.ownerId} onChange={(e) => setForm({ ...form, ownerId: e.target.value })} placeholder="e.g. user_cm..." />
          </Field>
          <Field label="City">
            <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Bengaluru" />
          </Field>
          <Field label="Description">
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Competitive doubles club…" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude" hint="For GPS radius">
              <Input type="number" step="any" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} placeholder="12.9716" />
            </Field>
            <Field label="Longitude" error={error}>
              <Input type="number" step="any" value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} placeholder="77.5946" />
            </Field>
          </div>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Provisioning Club…" : "Provision Club"}
          </Button>
        </form>
      </div>
    </main>
  );
}

export default function NewClubPage() {
  return (
    <SessionProvider>
      <CreateClubForm />
    </SessionProvider>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SessionProvider } from "@/components/session";
import { api } from "@/lib/client";
import { Button, Field, Input, Select } from "@/components/ui";

function CreateClubForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    city: "",
    description: "",
    lat: "",
    lng: ""
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
        <h1 className="text-2xl font-bold">Create your club</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You'll be the owner. Penalty rules and settings are pre-configured and editable later.
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
          <Field label="Club name">
            <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Smash Arena" />
          </Field>
          <Field label="City">
            <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Bengaluru" />
          </Field>
          <Field label="Description">
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Competitive doubles club…" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude" hint="For GPS check-in radius">
              <Input type="number" step="any" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} placeholder="12.9716" />
            </Field>
            <Field label="Longitude" error={error}>
              <Input type="number" step="any" value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} placeholder="77.5946" />
            </Field>
          </div>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Creating…" : "Create club"}
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

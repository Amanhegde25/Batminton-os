"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import {
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
  Building2,
  Search,
  RefreshCw,
  ExternalLink,
  Trash,
  Sliders,
  Check,
  Plus
} from "@/components/icons";

interface ClubItem {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  plan: string;
  owner: { name: string; email: string | null } | null;
  members: number;
  matches: number;
  courts: number;
  createdAt: string;
}

interface PlatformOverviewResponse {
  clubs: ClubItem[];
  planCounts: Record<string, number>;
}

export default function AdminClubsPage() {
  const [clubs, setClubs] = useState<ClubItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const { toast, node } = useToast();

  // Modals
  const [planModal, setPlanModal] = useState<{ club: ClubItem; newPlan: string } | null>(null);
  const [deleteModal, setDeleteModal] = useState<ClubItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadClubs() {
    setLoading(true);
    try {
      const res = await api<PlatformOverviewResponse>("/platform/overview");
      setClubs(res.clubs);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to load clubs", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadClubs();
  }, []);

  async function handlePlanChange() {
    if (!planModal) return;
    setSubmitting(true);
    try {
      await api(`/platform/clubs/${planModal.club.id}/plan`, {
        method: "PATCH",
        json: { plan: planModal.newPlan }
      });
      toast(`Updated subscription plan for ${planModal.club.name} to ${planModal.newPlan}`, "success");
      setPlanModal(null);
      void loadClubs();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to change plan", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteClub() {
    if (!deleteModal) return;
    setSubmitting(true);
    try {
      await api(`/platform/clubs/${deleteModal.id}`, {
        method: "DELETE"
      });
      toast(`Club "${deleteModal.name}" soft-deleted`, "success");
      setDeleteModal(null);
      void loadClubs();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to delete club", "error");
    } finally {
      setSubmitting(false);
    }
  }

  const filteredClubs = clubs.filter((c) => {
    const matchesSearch =
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.slug.toLowerCase().includes(search.toLowerCase()) ||
      (c.city && c.city.toLowerCase().includes(search.toLowerCase()));
    const matchesPlan = !planFilter || (c.plan || "FREE") === planFilter;
    return matchesSearch && matchesPlan;
  });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {node}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Clubs & Subscriptions</h1>
            <Badge tone="muted" className="font-mono">{clubs.length} clubs</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Manage multi-tenant clubs, assign subscription plans (FREE / PRO / PREMIUM), and inspect court & membership usage.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/clubs/new">
            <Button size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Create Club
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadClubs()}
            disabled={loading}
            className="gap-2 shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Search and Filter */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by club name, slug, or city..."
              className="pl-9.5"
            />
          </div>
          <div className="w-full sm:w-48">
            <Select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}>
              <option value="">All Plans</option>
              <option value="FREE">FREE</option>
              <option value="PRO">PRO</option>
              <option value="PREMIUM">PREMIUM</option>
            </Select>
          </div>
          {(search || planFilter) && (
            <Button
              variant="outline"
              onClick={() => {
                setSearch("");
                setPlanFilter("");
              }}
            >
              Reset
            </Button>
          )}
        </div>
      </Card>

      {/* Clubs Table */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner className="h-8 w-8 text-primary" />
        </div>
      ) : (
        <Table head={["Club", "Location", "Owner", "Members", "Courts", "Matches", "Plan", "Actions"]}>
          {filteredClubs.map((c) => (
            <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
              <Td>
                <div>
                  <div className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                    {c.name}
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono">/{c.slug}</div>
                </div>
              </Td>
              <Td className="text-muted-foreground">{c.city ?? "—"}</Td>
              <Td>
                {c.owner ? (
                  <div>
                    <div className="text-xs font-medium text-foreground">{c.owner.name}</div>
                    <div className="text-[10px] text-muted-foreground">{c.owner.email}</div>
                  </div>
                ) : (
                  "—"
                )}
              </Td>
              <Td className="tabular-nums font-mono">{c.members}</Td>
              <Td className="tabular-nums font-mono">{c.courts}</Td>
              <Td className="tabular-nums font-mono">{c.matches}</Td>
              <Td>
                <Badge
                  tone={
                    c.plan === "PREMIUM"
                      ? "accent"
                      : c.plan === "PRO"
                      ? "warning"
                      : "primary"
                  }
                  className="font-mono text-xs"
                >
                  {c.plan || "FREE"}
                </Badge>
              </Td>
              <Td>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPlanModal({ club: c, newPlan: c.plan || "FREE" })}
                    className="h-8 px-2.5 text-xs gap-1.5"
                  >
                    <Sliders className="h-3.5 w-3.5" />
                    Change Plan
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteModal(c)}
                    className="h-8 w-8 p-0"
                    title="Delete club"
                  >
                    <Trash className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      )}

      {/* Plan Changer Modal */}
      {planModal && (
        <Dialog
          open={!!planModal}
          onClose={() => !submitting && setPlanModal(null)}
          title={`Subscription Plan: ${planModal.club.name}`}
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select a tier for this tenant club. Features and limits take effect immediately.
            </p>

            <div className="space-y-2.5">
              {(["FREE", "PRO", "PREMIUM"] as const).map((tier) => (
                <label
                  key={tier}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                    planModal.newPlan === tier
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="plan"
                    value={tier}
                    checked={planModal.newPlan === tier}
                    onChange={() => setPlanModal({ ...planModal, newPlan: tier })}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{tier}</span>
                      <Badge tone={tier === "PREMIUM" ? "accent" : tier === "PRO" ? "warning" : "muted"}>
                        {tier === "FREE" ? "Standard" : tier === "PRO" ? "Pro Features" : "Enterprise"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {tier === "FREE" && "Includes standard match tracking, basic booking, and member roster."}
                      {tier === "PRO" && "Unlocks video analysis, QR sweep attendance, and tournament manager."}
                      {tier === "PREMIUM" && "Unlocks all AI coaching models, unlimited courts, custom branding."}
                    </p>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t">
              <Button variant="outline" onClick={() => setPlanModal(null)} disabled={submitting}>
                Cancel
              </Button>
              <Button onClick={() => void handlePlanChange()} disabled={submitting} className="gap-2">
                {submitting && <Spinner className="h-3.5 w-3.5" />}
                Save Changes
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <Dialog
          open={!!deleteModal}
          onClose={() => !submitting && setDeleteModal(null)}
          title="Delete Club"
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to soft-delete <strong>{deleteModal.name}</strong>?
              This will hide the club from directory lookups and disable all member interactions.
            </p>
            <div className="flex justify-end gap-3 pt-3 border-t">
              <Button variant="outline" onClick={() => setDeleteModal(null)} disabled={submitting}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => void handleDeleteClub()} disabled={submitting} className="gap-2">
                {submitting && <Spinner className="h-3.5 w-3.5" />}
                Delete Club
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

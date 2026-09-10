"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "@/components/session";
import { api } from "@/lib/client";
import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  Input,
  Select,
  Spinner,
  useToast
} from "@/components/ui";
import {
  Users,
  Handshake,
  Plus,
  Search,
  MapPin,
  Calendar,
  Sparkles,
  ArrowRight,
  Shield,
  Clock
} from "@/components/icons";

interface PlayGroupSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  city: string | null;
  skillLevel: string;
  isPublic: boolean;
  logoUrl: string | null;
  createdAt: string;
  memberCount: number;
  totalSessions: number;
  myMembership: { id: string; role: string; status: string } | null;
  nextSession: {
    id: string;
    title: string;
    scheduledDate: string;
    clubName: string;
    maxPlayers: number;
    confirmedRsvps: number;
  } | null;
}

export default function PlayGroupsPage() {
  const { me } = useSession();
  const [tab, setTab] = useState<"my" | "discover">("my");
  const [groups, setGroups] = useState<PlayGroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [skillFilter, setSkillFilter] = useState("ALL");

  // Create Modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("Bengaluru");
  const [skillLevel, setSkillLevel] = useState("ALL");
  const [isPublic, setIsPublic] = useState(true);

  const { toast, node: toastNode } = useToast();

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (tab === "my") params.set("myOnly", "true");
      if (search) params.set("q", search);
      const data = await api<PlayGroupSummary[]>(`/groups?${params.toString()}`);
      setGroups(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [tab, search]);

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setCreating(true);
    try {
      const newGroup = await api<{ id: string }>(`/groups`, {
        method: "POST",
        json: {
          name: name.trim(),
          description: description.trim() || undefined,
          city: city.trim() || undefined,
          skillLevel,
          isPublic
        }
      });
      toast(`Play Group "${name}" created!`);
      setCreateOpen(false);
      setName("");
      setDescription("");
      setTab("my");
      void load();
    } catch (err: any) {
      toast(err?.message || "Failed to create group", "error");
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin(groupId: string, groupName: string) {
    try {
      await api(`/groups/${groupId}/members`, { method: "POST" });
      toast(`Joined ${groupName}!`);
      void load();
    } catch (err: any) {
      toast(err?.message || "Failed to join group", "error");
    }
  }

  const filteredGroups = groups.filter((g) => {
    if (skillFilter !== "ALL" && g.skillLevel !== skillFilter && g.skillLevel !== "ALL") {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {toastNode}

      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-gradient-to-r from-card via-card to-primary/5 p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Handshake className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Play Groups & Squads</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Form groups with friends, schedule play sessions at different clubs, and track RSVPs together.
          </p>
        </div>

        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Create Play Group
        </Button>
      </div>

      {/* Filters and Tabs Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        {/* Switcher */}
        <div className="flex rounded-xl bg-muted p-1 text-xs sm:text-sm">
          <button
            onClick={() => setTab("my")}
            className={`rounded-lg px-4 py-1.5 font-medium transition ${
              tab === "my"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            My Squads
          </button>
          <button
            onClick={() => setTab("discover")}
            className={`rounded-lg px-4 py-1.5 font-medium transition ${
              tab === "discover"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Discover Groups
          </button>
        </div>

        {/* Search & Skill filter */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-48 sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search groups or city…"
              className="pl-9 text-xs sm:text-sm h-9"
            />
          </div>

          <Select
            value={skillFilter}
            onChange={(e) => setSkillFilter(e.target.value)}
            className="w-36 text-xs sm:text-sm h-9"
          >
            <option value="ALL">All Levels</option>
            <option value="BEGINNER">Beginner</option>
            <option value="INTERMEDIATE">Intermediate</option>
            <option value="ADVANCED">Advanced</option>
          </Select>
        </div>
      </div>

      {/* Group Cards Grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-7 w-7" />
        </div>
      ) : filteredGroups.length === 0 ? (
        <EmptyState
          title={tab === "my" ? "No play groups joined yet" : "No play groups found"}
          body={
            tab === "my"
              ? "Create your own squad or explore public groups to start scheduling matches across clubs."
              : "Try adjusting your search criteria or create a brand new group for your area."
          }
          icon={<Users className="h-10 w-10 text-muted-foreground" />}
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filteredGroups.map((g) => {
            const isLeader = g.myMembership?.role === "LEADER";
            const isMember = g.myMembership?.status === "ACTIVE";

            return (
              <Card
                key={g.id}
                className="group flex flex-col justify-between p-5 transition hover:border-primary/50 hover:shadow-md"
              >
                <div>
                  {/* Top row badges */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Badge tone="accent" className="text-[10px]">
                        {g.skillLevel}
                      </Badge>
                      {g.city && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" /> {g.city}
                        </span>
                      )}
                    </div>
                    {isLeader ? (
                      <Badge tone="warning" className="text-[10px]">Leader</Badge>
                    ) : isMember ? (
                      <Badge tone="success" className="text-[10px]">Member</Badge>
                    ) : (
                      <Badge tone="muted" className="text-[10px]">{g.isPublic ? "Public" : "Invite Only"}</Badge>
                    )}
                  </div>

                  {/* Group Name & Bio */}
                  <div className="mt-3">
                    <Link
                      href={`/app/groups/${g.id}`}
                      className="font-bold text-base hover:text-primary transition line-clamp-1"
                    >
                      {g.name}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {g.description || "A friendly badminton squad coordinating games across local clubs."}
                    </p>
                  </div>

                  {/* Next session teaser */}
                  <div className="mt-4 rounded-xl border bg-muted/40 p-3 text-xs">
                    <div className="flex items-center justify-between text-muted-foreground font-medium mb-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-primary" /> Next Session
                      </span>
                      {g.nextSession && (
                        <span className="text-primary font-semibold">
                          {g.nextSession.confirmedRsvps}/{g.nextSession.maxPlayers} Spots
                        </span>
                      )}
                    </div>
                    {g.nextSession ? (
                      <div className="text-foreground">
                        <p className="font-medium line-clamp-1">{g.nextSession.title}</p>
                        <p className="text-muted-foreground text-[11px] mt-0.5">
                          📍 {g.nextSession.clubName} ·{" "}
                          {new Date(g.nextSession.scheduledDate).toLocaleDateString("en-IN", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </p>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No upcoming session scheduled</p>
                    )}
                  </div>
                </div>

                {/* Footer specs & actions */}
                <div className="mt-4 border-t pt-3 flex items-center justify-between gap-3 text-xs">
                  <span className="text-muted-foreground font-medium flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {g.memberCount} {g.memberCount === 1 ? "Player" : "Players"}
                  </span>

                  {isMember ? (
                    <Link href={`/app/groups/${g.id}`}>
                      <Button size="sm" variant="outline" className="text-xs gap-1">
                        Open Squad <ArrowRight className="h-3 w-3" />
                      </Button>
                    </Link>
                  ) : (
                    <Button size="sm" onClick={() => handleJoin(g.id, g.name)} className="text-xs">
                      Join Group
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Group Modal */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="Create a New Play Group">
        <form onSubmit={handleCreateGroup} className="space-y-4 pt-1">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Group Name *
            </label>
            <Input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Bangalore Shuttle Masters"
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What days do you play? What style of badminton? (Doubles, singles, recreational?)"
              className="mt-1 w-full rounded-xl border bg-background p-3 text-sm focus:border-primary focus:outline-none"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                City / Region
              </label>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Bengaluru"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Skill Level
              </label>
              <Select
                value={skillLevel}
                onChange={(e) => setSkillLevel(e.target.value)}
                className="mt-1"
              >
                <option value="ALL">All Levels Welcome</option>
                <option value="BEGINNER">Beginner Friendly</option>
                <option value="INTERMEDIATE">Intermediate</option>
                <option value="ADVANCED">Advanced Competitive</option>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isPublic"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
            />
            <label htmlFor="isPublic" className="text-sm">
              Make this group publicly discoverable
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" size="sm" type="button" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" type="submit" disabled={creating || !name.trim()}>
              {creating ? <Spinner className="h-4 w-4" /> : "Create Squad"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

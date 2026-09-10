"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "@/components/session";
import { api } from "@/lib/client";
import {
  Avatar,
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
  Calendar,
  Clock,
  MapPin,
  Plus,
  ArrowLeft,
  ShuttlecockIcon,
  MessageSquare,
  Building2,
  Check,
  X,
  ExternalLink,
  DollarSign
} from "@/components/icons";

interface ClubOption {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
}

interface GroupDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  city: string | null;
  skillLevel: string;
  isPublic: boolean;
  logoUrl: string | null;
  createdAt: string;
  createdBy: { id: string; name: string; photoUrl: string | null };
  myMembership: { id: string; role: string; status: string } | null;
  members: {
    id: string;
    userId: string;
    role: string;
    joinedAt: string;
    user: {
      id: string;
      name: string;
      photoUrl: string | null;
      skillLevel: string | null;
      role: string;
    };
  }[];
  sessions: {
    id: string;
    title: string;
    clubId: string | null;
    clubName: string;
    clubAddress: string | null;
    scheduledDate: string;
    durationMinutes: number;
    maxPlayers: number;
    costPerPlayer: number | null;
    notes: string | null;
    status: string;
    createdById: string;
    club?: { id: string; name: string; city: string | null; address: string | null } | null;
    rsvps: {
      id: string;
      userId: string;
      status: string;
      user: { id: string; name: string; photoUrl: string | null };
    }[];
  }[];
  posts: {
    id: string;
    content: string;
    createdAt: string;
    user: { id: string; name: string; photoUrl: string | null };
  }[];
}

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { me } = useSession();

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"sessions" | "members" | "board">("sessions");
  const [clubsList, setClubsList] = useState<ClubOption[]>([]);

  // Schedule modal
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [sessionTitle, setSessionTitle] = useState("");
  const [selectedClubId, setSelectedClubId] = useState("");
  const [customClubName, setCustomClubName] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [sessionTime, setSessionTime] = useState("18:00");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [costRupees, setCostRupees] = useState("");
  const [sessionNotes, setSessionNotes] = useState("");

  // Post message
  const [postContent, setPostContent] = useState("");
  const [posting, setPosting] = useState(false);

  const { toast, node: toastNode } = useToast();

  async function load() {
    if (!id) return;
    try {
      const data = await api<GroupDetail>(`/groups/${id}`);
      setGroup(data);
    } catch (err: any) {
      toast(err?.message || "Could not load group", "error");
    } finally {
      setLoading(false);
    }
  }

  async function loadClubs() {
    try {
      const clubs = await api<ClubOption[]>(`/clubs`);
      setClubsList(clubs);
      if (clubs.length > 0) setSelectedClubId(clubs[0].id);
    } catch {}
  }

  useEffect(() => {
    void load();
    void loadClubs();
  }, [id]);

  async function handleJoin() {
    try {
      await api(`/groups/${id}/members`, { method: "POST" });
      toast("You have joined the squad!");
      void load();
    } catch (err: any) {
      toast(err?.message || "Failed to join squad", "error");
    }
  }

  async function handleLeave() {
    if (!confirm("Are you sure you want to leave this play group?")) return;
    try {
      await api(`/groups/${id}/members`, { method: "DELETE" });
      toast("You left the group.");
      router.push("/app/groups");
    } catch (err: any) {
      toast(err?.message || "Failed to leave group", "error");
    }
  }

  async function handleCreateSession(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionTitle.trim() || !sessionDate) {
      toast("Please provide session title and date.", "error");
      return;
    }

    setScheduling(true);
    try {
      const dateTimeStr = `${sessionDate}T${sessionTime}:00`;
      const chosenClub = clubsList.find((c) => c.id === selectedClubId);

      await api(`/groups/${id}/sessions`, {
        method: "POST",
        json: {
          title: sessionTitle.trim(),
          clubId: selectedClubId || undefined,
          clubName: chosenClub ? chosenClub.name : customClubName || "Badminton Club",
          clubAddress: chosenClub ? chosenClub.address : undefined,
          scheduledDate: new Date(dateTimeStr).toISOString(),
          durationMinutes: Number(durationMinutes),
          maxPlayers: Number(maxPlayers),
          costPerPlayer: costRupees ? Math.round(Number(costRupees) * 100) : undefined,
          notes: sessionNotes.trim() || undefined
        }
      });

      toast("Play session scheduled at the club!");
      setScheduleOpen(false);
      setSessionTitle("");
      setSessionNotes("");
      setCostRupees("");
      void load();
    } catch (err: any) {
      toast(err?.message || "Could not schedule session", "error");
    } finally {
      setScheduling(false);
    }
  }

  async function handleRsvp(sessionId: string, status: "YES" | "MAYBE" | "NO") {
    try {
      await api(`/groups/${id}/sessions/${sessionId}/rsvp`, {
        method: "POST",
        json: { status }
      });
      toast(status === "YES" ? "Confirmed! You are on the roster." : "RSVP updated.");
      void load();
    } catch (err: any) {
      toast(err?.message || "Could not update RSVP", "error");
    }
  }

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    if (!postContent.trim()) return;

    setPosting(true);
    try {
      await api(`/groups/${id}/posts`, {
        method: "POST",
        json: { content: postContent.trim() }
      });
      setPostContent("");
      void load();
    } catch (err: any) {
      toast(err?.message || "Failed to post message", "error");
    } finally {
      setPosting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!group) {
    return (
      <EmptyState
        title="Play Group not found"
        body="This group may have been removed or does not exist."
        icon={<Users className="h-10 w-10 text-muted-foreground" />}
      />
    );
  }

  const isMember = group.myMembership?.status === "ACTIVE";
  const isLeader = group.myMembership?.role === "LEADER";

  return (
    <div className="space-y-6">
      {toastNode}

      {/* Back button */}
      <Link
        href="/app/groups"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Play Groups
      </Link>

      {/* Hero Header */}
      <div className="rounded-2xl border bg-gradient-to-r from-card via-card to-primary/5 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{group.name}</h1>
              <Badge tone="accent">{group.skillLevel}</Badge>
              {isLeader && <Badge tone="warning">Group Leader</Badge>}
              {!isLeader && isMember && <Badge tone="success">Member</Badge>}
            </div>

            <p className="mt-2 text-sm text-muted-foreground max-w-2xl leading-relaxed">
              {group.description || "A badminton play squad coordinating matches across various local clubs."}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground font-medium">
              {group.city && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-primary" /> {group.city}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" /> {group.members.length} {group.members.length === 1 ? "Player" : "Players"}
              </span>
              <span>•</span>
              <span>Led by {group.createdBy.name}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {isMember ? (
              <>
                <Button onClick={() => setScheduleOpen(true)} className="gap-1.5 text-xs sm:text-sm">
                  <Plus className="h-4 w-4" /> Schedule Session
                </Button>
                <Button variant="outline" size="sm" onClick={handleLeave} className="text-xs text-destructive">
                  Leave Squad
                </Button>
              </>
            ) : (
              <Button onClick={handleJoin} className="gap-1.5 text-xs sm:text-sm">
                Join this Play Group
              </Button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mt-6 flex border-b text-sm font-medium">
          <button
            onClick={() => setActiveTab("sessions")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 transition ${
              activeTab === "sessions"
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Calendar className="h-4 w-4" /> Club Sessions ({group.sessions.length})
          </button>
          <button
            onClick={() => setActiveTab("members")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 transition ${
              activeTab === "members"
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="h-4 w-4" /> Members Roster ({group.members.length})
          </button>
          <button
            onClick={() => setActiveTab("board")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 transition ${
              activeTab === "board"
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <MessageSquare className="h-4 w-4" /> Squad Board ({group.posts.length})
          </button>
        </div>
      </div>

      {/* Tab: SESSIONS ACROSS CLUBS */}
      {activeTab === "sessions" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold sm:text-lg">Upcoming & Past Sessions</h2>
            {isMember && (
              <Button size="sm" variant="outline" onClick={() => setScheduleOpen(true)} className="gap-1 text-xs">
                <Plus className="h-3.5 w-3.5" /> New Session
              </Button>
            )}
          </div>

          {group.sessions.length === 0 ? (
            <EmptyState
              title="No play sessions scheduled yet"
              body="Coordinate your first group match at any club by clicking Schedule Session."
              icon={<Calendar className="h-10 w-10 text-muted-foreground" />}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {group.sessions.map((s) => {
                const confirmedRsvps = s.rsvps.filter((r) => r.status === "YES");
                const spotsLeft = Math.max(0, s.maxPlayers - confirmedRsvps.length);
                const myRsvp = s.rsvps.find((r) => r.userId === me?.id)?.status;
                const isFull = spotsLeft === 0;
                const isPast = new Date(s.scheduledDate) < new Date();

                return (
                  <Card key={s.id} className="flex flex-col justify-between p-5 transition hover:shadow-md">
                    <div>
                      {/* Top status */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="flex h-2 w-2 rounded-full bg-primary" />
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            {isPast ? "Past Session" : "Confirmed Match"}
                          </span>
                        </div>
                        <Badge tone={isFull ? "danger" : "primary"} className="text-[11px]">
                          {confirmedRsvps.length}/{s.maxPlayers} Spots Confirmed
                        </Badge>
                      </div>

                      {/* Title & Target Club Venue */}
                      <div className="mt-3">
                        <p className="text-base font-bold text-foreground">{s.title}</p>
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-primary font-medium">
                          <Building2 className="h-3.5 w-3.5 shrink-0" />
                          <span>Playing at: {s.clubName}</span>
                        </div>
                        {s.clubAddress && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            📍 {s.clubAddress}
                          </p>
                        )}
                      </div>

                      {/* Schedule timing & Cost */}
                      <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-muted/40 p-2.5 text-xs">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Clock className="h-3.5 w-3.5 text-primary" />
                          <span>
                            {new Date(s.scheduledDate).toLocaleString("en-IN", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit"
                            })}{" "}
                            ({s.durationMinutes}m)
                          </span>
                        </div>
                        <div className="flex items-center justify-end gap-1 font-medium text-foreground">
                          {s.costPerPlayer ? `₹${(s.costPerPlayer / 100).toFixed(0)}/player` : "Split court fee"}
                        </div>
                      </div>

                      {/* Notes */}
                      {s.notes && (
                        <p className="mt-2 text-xs text-muted-foreground italic line-clamp-2">
                          &ldquo;{s.notes}&rdquo;
                        </p>
                      )}

                      {/* Attendees Avatars */}
                      <div className="mt-3">
                        <p className="text-[11px] font-semibold uppercase text-muted-foreground mb-1.5">
                          Confirmed Roster ({confirmedRsvps.length})
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {confirmedRsvps.length === 0 ? (
                            <span className="text-xs text-muted-foreground italic">No confirmed players yet</span>
                          ) : (
                            confirmedRsvps.map((r) => (
                              <div
                                key={r.id}
                                className="flex items-center gap-1 rounded-full border bg-background py-0.5 pl-0.5 pr-2 text-xs font-medium"
                                title={r.user.name}
                              >
                                <Avatar name={r.user.name} src={r.user.photoUrl} size={20} />
                                <span className="truncate max-w-[80px]">{r.user.name.split(" ")[0]}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    {/* RSVP Action Bar */}
                    <div className="mt-5 border-t pt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                      {isMember ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-muted-foreground font-medium mr-1">Your RSVP:</span>
                          <button
                            type="button"
                            disabled={isFull && myRsvp !== "YES"}
                            onClick={() => handleRsvp(s.id, "YES")}
                            className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                              myRsvp === "YES"
                                ? "bg-primary text-primary-foreground"
                                : "border bg-background hover:bg-muted text-foreground"
                            }`}
                          >
                            Going
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRsvp(s.id, "MAYBE")}
                            className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                              myRsvp === "MAYBE"
                                ? "bg-amber-500 text-white"
                                : "border bg-background hover:bg-muted text-foreground"
                            }`}
                          >
                            Maybe
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRsvp(s.id, "NO")}
                            className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                              myRsvp === "NO"
                                ? "bg-destructive text-white"
                                : "border bg-background hover:bg-muted text-foreground"
                            }`}
                          >
                            Can&apos;t Go
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Join squad to RSVP</span>
                      )}

                      {/* Club booking shortcut */}
                      {s.clubId && (
                        <Link
                          href={`/app/courts`}
                          className="inline-flex items-center gap-1 text-xs text-primary font-semibold hover:underline"
                        >
                          Book at {s.clubName.split(" ")[0]} <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: MEMBERS ROSTER */}
      {activeTab === "members" && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold">Squad Roster ({group.members.length} Players)</h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.members.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 rounded-xl border p-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar name={m.user.name} src={m.user.photoUrl} size={36} />
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{m.user.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {m.user.skillLevel?.toLowerCase() || "Player"}
                    </p>
                  </div>
                </div>
                <Badge tone={m.role === "LEADER" ? "warning" : "muted"} className="text-[10px]">
                  {m.role}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Tab: SQUAD BOARD / DISCUSSIONS */}
      {activeTab === "board" && (
        <Card className="p-5 space-y-4">
          <h2 className="text-base font-bold">Squad Discussions & Notes</h2>

          {isMember && (
            <form onSubmit={handlePost} className="space-y-2 border-b pb-4">
              <textarea
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                placeholder="Post a message, propose a new club, or announce shuttlecock arrangements…"
                className="w-full rounded-xl border bg-background p-3 text-sm focus:border-primary focus:outline-none"
                rows={2}
              />
              <div className="flex justify-end">
                <Button size="sm" type="submit" disabled={posting || !postContent.trim()}>
                  {posting ? <Spinner className="h-4 w-4" /> : "Post to Squad"}
                </Button>
              </div>
            </form>
          )}

          {group.posts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No discussions yet. Post the first message!
            </p>
          ) : (
            <div className="space-y-3">
              {group.posts.map((p) => (
                <div key={p.id} className="flex items-start gap-3 rounded-xl border bg-muted/20 p-3.5">
                  <Avatar name={p.user.name} src={p.user.photoUrl} size={32} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs">{p.user.name}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(p.createdAt).toLocaleDateString("en-IN", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-foreground leading-relaxed">{p.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Schedule Session Modal */}
      <Dialog open={scheduleOpen} onClose={() => setScheduleOpen(false)} title="Schedule Club Session">
        <form onSubmit={handleCreateSession} className="space-y-4 pt-1">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Session Title *
            </label>
            <Input
              required
              value={sessionTitle}
              onChange={(e) => setSessionTitle(e.target.value)}
              placeholder="e.g. Wednesday Evening Doubles Battle"
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Select Badminton Club Venue *
            </label>
            <Select
              value={selectedClubId}
              onChange={(e) => setSelectedClubId(e.target.value)}
              className="mt-1"
            >
              {clubsList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.city ? `(${c.city})` : ""}
                </option>
              ))}
              <option value="">Other / External Venue…</option>
            </Select>
          </div>

          {!selectedClubId && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Custom Venue Name
              </label>
              <Input
                value={customClubName}
                onChange={(e) => setCustomClubName(e.target.value)}
                placeholder="Enter court / club name"
                className="mt-1"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Date *
              </label>
              <Input
                type="date"
                required
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Start Time *
              </label>
              <Input
                type="time"
                required
                value={sessionTime}
                onChange={(e) => setSessionTime(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Duration
              </label>
              <Select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="mt-1"
              >
                <option value={60}>1 Hour</option>
                <option value={90}>1.5 Hours</option>
                <option value={120}>2 Hours</option>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Max Players
              </label>
              <Input
                type="number"
                min={2}
                max={20}
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(Number(e.target.value))}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Cost/Player (₹)
              </label>
              <Input
                type="number"
                min={0}
                placeholder="e.g. 200"
                value={costRupees}
                onChange={(e) => setCostRupees(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Notes / Court Number
            </label>
            <Input
              value={sessionNotes}
              onChange={(e) => setSessionNotes(e.target.value)}
              placeholder="e.g. Court 2 reserved. Bring Yonex Mavis 350 shuttles!"
              className="mt-1"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" size="sm" type="button" onClick={() => setScheduleOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" type="submit" disabled={scheduling}>
              {scheduling ? <Spinner className="h-4 w-4" /> : "Schedule Session"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import {
  Badge,
  Button,
  Card,
  Dialog,
  Field,
  Input,
  Select,
  Spinner,
  Textarea,
  useToast
} from "@/components/ui";
import {
  Settings,
  Trash,
  Check,
  Lock,
  Unlock
} from "@/components/icons";

interface GroupData {
  id: string;
  name: string;
  description: string | null;
  city: string | null;
  skillLevel: string;
  isPublic: boolean;
}

export default function GroupAdminSettingsPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("");
  const [skillLevel, setSkillLevel] = useState("ALL");
  const [isPublic, setIsPublic] = useState(true);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast, node } = useToast();

  useEffect(() => {
    async function loadGroup() {
      if (!id) return;
      try {
        const g = await api<GroupData>(`/groups/${id}`);
        setName(g.name);
        setDescription(g.description || "");
        setCity(g.city || "");
        setSkillLevel(g.skillLevel || "ALL");
        setIsPublic(g.isPublic ?? true);
      } catch (err) {
        toast(err instanceof Error ? err.message : "Failed to load group", "error");
      } finally {
        setLoading(false);
      }
    }
    void loadGroup();
  }, [id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !name.trim()) return;
    setSaving(true);
    try {
      await api(`/groups/${id}`, {
        method: "PATCH",
        json: {
          name: name.trim(),
          description: description.trim(),
          city: city.trim(),
          skillLevel,
          isPublic
        }
      });
      toast("PlayGroup details updated!", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save changes", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteGroup() {
    if (!id) return;
    setDeleting(true);
    try {
      await api(`/groups/${id}`, { method: "DELETE" });
      toast("PlayGroup removed", "success");
      router.push("/app/groups");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to delete group", "error");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl">
      {node}

      <div>
        <h2 className="text-lg font-semibold tracking-tight">PlayGroup Preferences & Discovery</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Modify squad details visible on the public PlayGroup directory.
        </p>
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="space-y-4">
        <Card className="p-6 space-y-4">
          <Field label="Group Name" hint="Choose a recognizable name for your squad">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Indiranagar Weekend Smashers"
              required
              maxLength={60}
            />
          </Field>

          <Field label="Description & Bio" hint="Explain the playing culture, frequency, or house rules">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your badminton group..."
              rows={3}
              maxLength={500}
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="City / Region" hint="Local metropolitan area">
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Bangalore, Mumbai"
                maxLength={60}
              />
            </Field>

            <Field label="Skill Level Target">
              <Select value={skillLevel} onChange={(e) => setSkillLevel(e.target.value)}>
                <option value="ALL">All Levels Welcome</option>
                <option value="BEGINNER">Beginner Only</option>
                <option value="INTERMEDIATE">Intermediate</option>
                <option value="ADVANCED">Advanced</option>
                <option value="PRO">Competitive / Pro</option>
              </Select>
            </Field>
          </div>

          <Field label="Privacy & Membership" hint="Control whether anyone can join without approval">
            <div className="flex gap-3 pt-1">
              <label className={`flex-1 flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                isPublic ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
              }`}>
                <input
                  type="radio"
                  name="visibility"
                  checked={isPublic}
                  onChange={() => setIsPublic(true)}
                  className="mt-0.5"
                />
                <div>
                  <div className="font-semibold text-xs flex items-center gap-1.5">
                    <Unlock className="h-3.5 w-3.5 text-emerald-500" /> Public Community
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Listed in public directory; any player can join and RSVP.
                  </p>
                </div>
              </label>

              <label className={`flex-1 flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                !isPublic ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
              }`}>
                <input
                  type="radio"
                  name="visibility"
                  checked={!isPublic}
                  onChange={() => setIsPublic(false)}
                  className="mt-0.5"
                />
                <div>
                  <div className="font-semibold text-xs flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-amber-500" /> Private Squad
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Hidden from search; join requires leader approval.
                  </p>
                </div>
              </label>
            </div>
          </Field>

          <div className="pt-3 border-t border-border/50 flex justify-end">
            <Button type="submit" disabled={saving || !name.trim()} className="gap-2 text-xs">
              {saving && <Spinner className="h-3.5 w-3.5" />}
              Save Group Settings
            </Button>
          </div>
        </Card>
      </form>

      {/* Danger Zone */}
      <Card className="p-6 border-destructive/30 bg-destructive/5 space-y-3">
        <h3 className="text-sm font-semibold text-destructive flex items-center gap-1.5">
          <Trash className="h-4 w-4" /> Danger Zone
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Deleting this PlayGroup will permanently hide it from player discovery, cancel scheduled sessions, and disband the squad.
        </p>
        <div className="pt-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteOpen(true)}
            className="text-xs gap-1.5"
          >
            <Trash className="h-3.5 w-3.5" /> Disband PlayGroup
          </Button>
        </div>
      </Card>

      {/* Delete Dialog */}
      {deleteOpen && (
        <Dialog
          open={deleteOpen}
          onClose={() => !deleting && setDeleteOpen(false)}
          title="Disband PlayGroup"
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to disband <strong>{name}</strong>? All members will be removed and upcoming sessions cancelled.
            </p>
            <div className="flex justify-end gap-3 pt-3 border-t">
              <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => void handleDeleteGroup()} disabled={deleting} className="gap-2">
                {deleting && <Spinner className="h-3.5 w-3.5" />}
                Disband Squad
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

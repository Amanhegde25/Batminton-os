"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Dialog,
  Spinner,
  useToast
} from "@/components/ui";
import {
  MessageSquare,
  Trash,
  Clock,
  RefreshCw,
  ShieldAlert
} from "@/components/icons";

interface PostItem {
  id: string;
  groupId: string;
  userId: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    photoUrl: string | null;
  } | null;
}

export default function GroupAdminPostsPage() {
  const params = useParams();
  const id = params?.id as string;

  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteModal, setDeleteModal] = useState<PostItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast, node } = useToast();

  async function loadPosts() {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api<PostItem[]>(`/groups/${id}/posts`);
      setPosts(res);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to load posts", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPosts();
  }, [id]);

  async function handleDeletePost() {
    if (!deleteModal || !id) return;
    setDeleting(true);
    try {
      await api(`/groups/${id}/posts/${deleteModal.id}`, { method: "DELETE" });
      toast("Post removed from feed", "success");
      setDeleteModal(null);
      void loadPosts();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to delete post", "error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {node}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Community Feed Moderation</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Review and remove spam, abusive comments, or off-topic posts in your PlayGroup channel.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadPosts()} className="gap-1.5 shrink-0">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner className="h-8 w-8 text-primary" />
        </div>
      ) : posts.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground mx-auto mb-3">
            <MessageSquare className="h-6 w-6" />
          </div>
          <h3 className="font-semibold text-foreground">No posts yet</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
            Group members haven't posted any messages in the discussion feed yet.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <Card key={post.id} className="p-4 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <Avatar name={post.user?.name || "Player"} photoUrl={post.user?.photoUrl} size={36} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-foreground">{post.user?.name || "Unnamed Player"}</span>
                    <span className="text-[11px] text-muted-foreground font-mono flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(post.createdAt).toLocaleDateString()} {new Date(post.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-xs text-foreground/90 mt-1.5 whitespace-pre-wrap leading-relaxed break-words">
                    {post.content}
                  </p>
                </div>
              </div>

              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteModal(post)}
                className="h-8 px-2.5 text-xs shrink-0 gap-1.5"
                title="Remove post"
              >
                <Trash className="h-3.5 w-3.5" />
                Remove
              </Button>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteModal && (
        <Dialog
          open={!!deleteModal}
          onClose={() => !deleting && setDeleteModal(null)}
          title="Remove Post"
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete this message posted by <strong>{deleteModal.user?.name || "Player"}</strong>?
            </p>
            <div className="p-3 rounded-xl border bg-muted/40 text-xs italic text-muted-foreground">
              "{deleteModal.content}"
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t">
              <Button variant="outline" onClick={() => setDeleteModal(null)} disabled={deleting}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => void handleDeletePost()} disabled={deleting} className="gap-2">
                {deleting && <Spinner className="h-3.5 w-3.5" />}
                Delete Post
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

import { notifications } from "@/server/db";
import { NOTIFICATION_TYPES } from "@/lib/constants";
import { cuid } from "@/lib/id";

export interface NotifyInput {
  userId: string;
  clubId?: string | null;
  type: keyof typeof NOTIFICATION_TYPES | string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
}

export async function notify(input: NotifyInput): Promise<void> {
  try {
    await notifications().insertOne({
      id: cuid(),
      userId: input.userId,
      clubId: input.clubId ?? null,
      type: String(input.type),
      title: input.title,
      body: input.body ?? null,
      data: input.data ? JSON.stringify(input.data) : null,
      readAt: null,
      createdAt: new Date()
    });
  } catch (e) {
    console.error("[notify] failed", e);
  }
}

export async function notifyMany(inputs: NotifyInput[]): Promise<void> {
  await Promise.all(inputs.map(notify));
}

export async function listNotifications(userId: string, page = 1, pageSize = 30) {
  const skip = (page - 1) * pageSize;
  const [items, total, unread] = await Promise.all([
    notifications().find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(pageSize).toArray(),
    notifications().countDocuments({ userId }),
    notifications().countDocuments({ userId, readAt: null })
  ]);
  return {
    items: items.map(withParsedData),
    total,
    unread,
    page,
    pageSize
  };
}

export async function unreadCount(userId: string): Promise<number> {
  return notifications().countDocuments({ userId, readAt: null });
}

export async function markRead(userId: string, ids?: string[]): Promise<number> {
  const filter: Record<string, unknown> = { userId, readAt: null };
  if (ids && ids.length) filter.id = { $in: ids };
  const res = await notifications().updateMany(filter, { $set: { readAt: new Date() } });
  return res.modifiedCount;
}

function withParsedData(n: Record<string, unknown>) {
  let parsed: unknown = null;
  try {
    parsed = n.data ? JSON.parse(n.data as string) : null;
  } catch {}
  return { ...n, data: parsed };
}

import { prisma } from "@/server/db";
import { NOTIFICATION_TYPES } from "@/lib/constants";

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
    await prisma.notification.create({
      data: {
        userId: input.userId,
        clubId: input.clubId ?? null,
        type: String(input.type),
        title: input.title,
        body: input.body,
        data: input.data ? JSON.stringify(input.data) : null
      }
    });
  } catch (e) {
    console.error("[notify] failed", e);
  }
}

export async function notifyMany(inputs: NotifyInput[]): Promise<void> {
  await Promise.all(inputs.map(notify));
}

export async function listNotifications(userId: string, page = 1, pageSize = 30) {
  const [items, total, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.notification.count({ where: { userId } }),
    prisma.notification.count({ where: { userId, readAt: null } })
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
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function markRead(userId: string, ids?: string[]): Promise<number> {
  const res = await prisma.notification.updateMany({
    where: { userId, readAt: null, ...(ids && ids.length ? { id: { in: ids } } : {}) },
    data: { readAt: new Date() }
  });
  return res.count;
}

function withParsedData(n: { data: string | null }) {
  let parsed: unknown = null;
  try {
    parsed = n.data ? JSON.parse(n.data) : null;
  } catch {}
  return { ...n, data: parsed };
}

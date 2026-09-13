import { db } from "@/server/db";

export async function GET() {
  try {
    await db.command({ ping: 1 });
    return Response.json({ status: "ok", db: "up", time: new Date().toISOString() });
  } catch {
    return Response.json({ status: "degraded", db: "down" }, { status: 500 });
  }
}

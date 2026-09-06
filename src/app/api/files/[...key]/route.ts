import { getStorage, MIME_BY_EXT } from "@/server/providers/storage";

export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key: segments } = await params;
  const key = segments.join("/");
  if (!key || key.includes("..") || key.includes("\\")) {
    return new Response("Bad request", { status: 400 });
  }
  const data = await getStorage().get(key);
  if (!data) return new Response("Not found", { status: 404 });
  const dot = key.lastIndexOf(".");
  const ext = dot >= 0 ? key.slice(dot) : "";
  const mime = MIME_BY_EXT[ext] ?? "application/octet-stream";
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(data.length),
      "Cache-Control": "public, max-age=31536000, immutable"
    }
  });
}

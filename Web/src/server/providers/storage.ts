import fs from "node:fs";
import path from "node:path";
import { env } from "@/lib/env";

export interface StorageProvider {
  name: string;
  put(key: string, data: Buffer, contentType?: string): Promise<{ key: string; url: string }>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
}

class LocalDiskProvider implements StorageProvider {
  name = "local";
  private baseDir = path.resolve(process.cwd(), env.dataDir);

  private resolve(key: string): string {
    const safe = key.replace(/\\/g, "/").split("/").filter((p) => p && p !== "." && p !== "..");
    return path.join(this.baseDir, ...safe);
  }

  async put(key: string, data: Buffer): Promise<{ key: string; url: string }> {
    const full = this.resolve(key);
    await fs.promises.mkdir(path.dirname(full), { recursive: true });
    await fs.promises.writeFile(full, data);
    return { key, url: `/api/files/${key}` };
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await fs.promises.readFile(this.resolve(key));
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.promises.unlink(this.resolve(key));
    } catch {}
  }
}

class S3ProviderStub implements StorageProvider {
  name = "s3";
  async put(): Promise<{ key: string; url: string }> {
    throw new Error("S3 storage provider requires S3_BUCKET / S3_REGION / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY env vars and the @aws-sdk/client-s3 package. Set STORAGE_PROVIDER=local or install/configure the SDK.");
  }
  async get(): Promise<Buffer | null> {
    throw new Error("S3 storage provider is not configured. See docs/ARCHITECTURE.md.");
  }
  async delete(): Promise<void> {}
}

export function getStorage(): StorageProvider {
  if (env.storageProvider === "s3") return new S3ProviderStub();
  return new LocalDiskProvider();
}

export const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".pdf": "application/pdf"
};

function get(key: string): string | undefined {
  return process.env[key];
}

export const env = {
  get databaseUrl(): string {
    return get("DATABASE_URL") ?? "";
  },
  get appSecret(): string {
    return get("APP_SECRET") || "bcos-insecure-dev-secret-change-me-0123456789";
  },
  get isProd(): boolean {
    return process.env.NODE_ENV === "production";
  },
  get storageProvider(): string {
    return get("STORAGE_PROVIDER") || "local";
  },
  get dataDir(): string {
    return get("DATA_DIR") || "./data/uploads";
  },
  get aiProvider(): string {
    return get("AI_PROVIDER") || "rulebased";
  },
  get openaiKey(): string | undefined {
    return get("OPENAI_API_KEY");
  },
  get openaiModel(): string {
    return get("OPENAI_MODEL") || "gpt-4o-mini";
  },
  get otpProvider(): string {
    return get("OTP_PROVIDER") || "mock";
  },
  get googleClientId(): string | undefined {
    return get("GOOGLE_CLIENT_ID");
  },
  get googleClientSecret(): string | undefined {
    return get("GOOGLE_CLIENT_SECRET");
  },
  get cronSecret(): string | undefined {
    return get("CRON_SECRET");
  },
  get redisUrl(): string | undefined {
    return get("REDIS_URL");
  },
  get googleEnabled(): boolean {
    return Boolean(get("GOOGLE_CLIENT_ID") && get("GOOGLE_CLIENT_SECRET"));
  }
};

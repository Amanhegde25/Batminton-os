import { NextResponse } from "next/server";
import { ZodError, type ZodTypeAny, type output } from "zod";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError(400, "BAD_REQUEST", message, details);
  }
  static validation(message: string, details?: unknown) {
    return new ApiError(422, "VALIDATION_ERROR", message, details);
  }
  static unauthorized(message = "Authentication required") {
    return new ApiError(401, "UNAUTHORIZED", message);
  }
  static forbidden(message = "You do not have permission to do this", code = "FORBIDDEN") {
    return new ApiError(403, code, message);
  }
  static notFound(message = "Not found") {
    return new ApiError(404, "NOT_FOUND", message);
  }
  static conflict(message: string) {
    return new ApiError(409, "CONFLICT", message);
  }
  static paymentRequired(message: string, code = "FEATURE_LOCKED") {
    return new ApiError(402, code, message);
  }
  static tooMany(message = "Too many requests. Try again shortly.") {
    return new ApiError(429, "RATE_LIMITED", message);
  }
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(err: unknown): NextResponse {
  if (err instanceof ZodError) {
    const first = err.issues[0];
    const path = first?.path?.join(".") ?? "";
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: `${path ? path + ": " : ""}${first?.message ?? "Invalid input"}`,
          details: err.issues
        }
      },
      { status: 422 }
    );
  }
  if (err instanceof ApiError) {
    return NextResponse.json(
      { ok: false, error: { code: err.code, message: err.message, details: err.details } },
      { status: err.status }
    );
  }
  console.error("[api] unhandled", err);
  const msg = err instanceof Error ? err.message : "Internal server error";
  return NextResponse.json({ ok: false, error: { code: "INTERNAL", message: msg } }, { status: 500 });
}

type Ctx = { params: Promise<Record<string, string>> };

export function handler(fn: (req: Request, ctx: Ctx) => Promise<NextResponse>) {
  return async (req: Request, ctx: Ctx): Promise<NextResponse> => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      return fail(e);
    }
  };
}

export async function parseBody<S extends ZodTypeAny>(req: Request, schema: S): Promise<output<S>> {
  let raw: unknown = {};
  try {
    raw = await req.json();
  } catch {
    raw = {};
  }
  return schema.parse(raw) as output<S>;
}

export function parseQuery<S extends ZodTypeAny>(req: Request, schema: S): output<S> {
  const url = new URL(req.url);
  const obj: Record<string, string> = {};
  url.searchParams.forEach((v, k) => {
    obj[k] = v;
  });
  return schema.parse(obj) as output<S>;
}

export function getIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return "local";
}

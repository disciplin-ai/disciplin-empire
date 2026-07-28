import { NextResponse } from "next/server";
import type { RateLimitLease } from "./rateLimit";

export function unauthorized() {
  return NextResponse.json(
    { ok: false, error: "Authentication required." },
    { status: 401 },
  );
}

export function rateLimited(lease: Extract<RateLimitLease, { ok: false }>) {
  return NextResponse.json(
    { ok: false, error: "Too many requests. Wait before trying again." },
    {
      status: 429,
      headers: { "Retry-After": String(lease.retryAfterSeconds) },
    },
  );
}

export function safeServerError(requestId?: string) {
  return NextResponse.json(
    {
      ok: false,
      error: "The request could not be completed.",
      ...(requestId ? { requestId } : {}),
    },
    { status: 500 },
  );
}

export function requestId(request: Request) {
  const incoming = request.headers.get("x-request-id");
  return incoming && /^[A-Za-z0-9_-]{8,80}$/.test(incoming)
    ? incoming
    : crypto.randomUUID();
}

export function logServerError(
  scope: string,
  id: string,
  error?: unknown,
) {
  if (process.env.NODE_ENV !== "production") {
    console.error(`[${scope}] request ${id} failed`, error);
    return;
  }
  console.error(JSON.stringify({ level: "error", scope, requestId: id }));
}

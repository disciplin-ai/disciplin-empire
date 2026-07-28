export type ExpensiveRoute =
  | "vision"
  | "vision-proof"
  | "sensei"
  | "fuel"
  | "fuel-photo";

export const EXPENSIVE_ROUTE_LIMITS: Record<
  ExpensiveRoute,
  {
    windowMs: number;
    maxPerWindow: number;
    maxPerDay: number;
    maxConcurrent: number;
  }
> = {
  vision: { windowMs: 60_000, maxPerWindow: 10, maxPerDay: 60, maxConcurrent: 2 },
  "vision-proof": {
    windowMs: 60_000,
    maxPerWindow: 12,
    maxPerDay: 100,
    maxConcurrent: 2,
  },
  sensei: { windowMs: 60_000, maxPerWindow: 20, maxPerDay: 200, maxConcurrent: 2 },
  fuel: { windowMs: 60_000, maxPerWindow: 20, maxPerDay: 200, maxConcurrent: 2 },
  "fuel-photo": {
    windowMs: 60_000,
    maxPerWindow: 10,
    maxPerDay: 60,
    maxConcurrent: 2,
  },
};

type Bucket = {
  windowStartedAt: number;
  windowCount: number;
  dayStartedAt: number;
  dayCount: number;
  concurrent: number;
};

const buckets = new Map<string, Bucket>();
const DAY_MS = 24 * 60 * 60 * 1000;

function bucketFor(key: string, now: number) {
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = {
      windowStartedAt: now,
      windowCount: 0,
      dayStartedAt: now,
      dayCount: 0,
      concurrent: 0,
    };
    buckets.set(key, bucket);
  }
  return bucket;
}

function refreshBucket(
  bucket: Bucket,
  now: number,
  policy: (typeof EXPENSIVE_ROUTE_LIMITS)[ExpensiveRoute],
) {
  if (now - bucket.windowStartedAt >= policy.windowMs) {
    bucket.windowStartedAt = now;
    bucket.windowCount = 0;
  }
  if (now - bucket.dayStartedAt >= DAY_MS) {
    bucket.dayStartedAt = now;
    bucket.dayCount = 0;
  }
}

export type RateLimitLease =
  | { ok: false; retryAfterSeconds: number }
  | { ok: true; release: () => void };

export function acquireExpensiveRequest(input: {
  route: ExpensiveRoute;
  userId: string;
  ip?: string | null;
  now?: number;
}): RateLimitLease {
  const now = input.now ?? Date.now();
  const policy = EXPENSIVE_ROUTE_LIMITS[input.route];
  const keys = [`${input.route}:user:${input.userId}`];
  if (input.ip && input.ip !== "unknown") {
    keys.push(`${input.route}:ip:${input.ip}`);
  }

  const entries = keys.map((key, index) => {
    const bucket = bucketFor(key, now);
    refreshBucket(bucket, now, policy);
    const multiplier = index === 0 ? 1 : 3;
    return { bucket, multiplier };
  });

  for (const { bucket, multiplier } of entries) {
    if (
      bucket.concurrent >= policy.maxConcurrent * multiplier ||
      bucket.windowCount >= policy.maxPerWindow * multiplier ||
      bucket.dayCount >= policy.maxPerDay * multiplier
    ) {
      const retryMs = Math.max(
        1_000,
        policy.windowMs - (now - bucket.windowStartedAt),
      );
      return { ok: false, retryAfterSeconds: Math.ceil(retryMs / 1_000) };
    }
  }

  for (const { bucket } of entries) {
    bucket.concurrent += 1;
    bucket.windowCount += 1;
    bucket.dayCount += 1;
  }

  let released = false;
  return {
    ok: true,
    release() {
      if (released) return;
      released = true;
      for (const { bucket } of entries) {
        bucket.concurrent = Math.max(0, bucket.concurrent - 1);
      }
    },
  };
}

export function requestIp(request: Request) {
  const value =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown";
  return value.slice(0, 64);
}

export function resetRateLimitsForTests() {
  buckets.clear();
}

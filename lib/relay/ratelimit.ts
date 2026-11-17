// Lightweight in-memory sliding-window limiter. Per serverless instance, so
// warm fleets share nothing — acceptable for a demo, documented in THREAT-MODEL.
// For production, swap this for Upstash or @vercel/kv.

type Entry = { count: number; windowStart: number };
const buckets = new Map<string, Entry>();
const MAX_BUCKETS = 10_000;

export type RateLimitResult = { ok: boolean; remaining: number; resetMs: number };

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const e = buckets.get(key);
  if (!e || now - e.windowStart >= windowMs) {
    if (buckets.size > MAX_BUCKETS) {
      // Opportunistic prune: drop the first 1% to keep memory bounded.
      const drop = Math.ceil(MAX_BUCKETS / 100);
      let i = 0;
      for (const k of buckets.keys()) {
        if (i++ >= drop) break;
        buckets.delete(k);
      }
    }
    buckets.set(key, { count: 1, windowStart: now });
    return { ok: true, remaining: limit - 1, resetMs: windowMs };
  }
  if (e.count >= limit) {
    return { ok: false, remaining: 0, resetMs: windowMs - (now - e.windowStart) };
  }
  e.count++;
  return { ok: true, remaining: limit - e.count, resetMs: windowMs - (now - e.windowStart) };
}

export function clientIp(req: Request): string {
  const h = req.headers;
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip") || "unknown";
}

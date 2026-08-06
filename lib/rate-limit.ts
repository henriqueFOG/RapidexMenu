import { sha256Hex } from "./security";

export async function rateLimitKey(request: Request, scope: string) {
  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  return `${scope}:${await sha256Hex(ip)}`;
}

export async function consumeRateLimit(
  db: D1Database,
  key: string,
  limit: number,
  windowMs: number,
) {
  const timestamp = Date.now();
  const expiresAt = timestamp + windowMs;
  const row = await db
    .prepare(
      `INSERT INTO rate_limit_buckets (key, count, expires_at, updated_at)
       VALUES (?, 1, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         count = CASE WHEN rate_limit_buckets.expires_at <= excluded.updated_at THEN 1 ELSE rate_limit_buckets.count + 1 END,
         expires_at = CASE WHEN rate_limit_buckets.expires_at <= excluded.updated_at THEN excluded.expires_at ELSE rate_limit_buckets.expires_at END,
         updated_at = excluded.updated_at
       RETURNING count, expires_at`,
    )
    .bind(key, expiresAt, timestamp)
    .first<{ count: number; expires_at: number }>();

  return {
    allowed: Boolean(row && row.count <= limit),
    remaining: Math.max(0, limit - (row?.count ?? limit)),
    resetAt: row?.expires_at ?? expiresAt,
  };
}

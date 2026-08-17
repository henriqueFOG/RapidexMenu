import { del, list } from "@vercel/blob";
import { getBindings, getDatabase, getRapidexEnvironment } from "./runtime";

const DAY_MS = 24 * 60 * 60 * 1000;
const GRACE_MS = DAY_MS;
const MAX_SCAN = 5_000;
const MAX_DELETE = 500;

type CleanupResult = {
  ran: boolean;
  provider: "r2" | "vercel_blob" | "database" | "none";
  scanned: number;
  deleted: number;
};

export async function cleanupOrphanMedia(): Promise<CleanupResult> {
  const db = getDatabase();
  const now = Date.now();
  const claim = await db.prepare(
    `UPDATE maintenance_schedules
     SET next_run_at = ?, last_started_at = ?, status = 'running', detail = NULL
     WHERE task = 'orphan_media' AND next_run_at <= ?
     RETURNING task`,
  ).bind(now + DAY_MS, now, now).first<{ task: string }>();
  if (!claim) return { ran: false, provider: "none", scanned: 0, deleted: 0 };

  try {
    const referenced = await referencedImageKeys(db);
    const cutoff = now - GRACE_MS;
    const bindings = getBindings();
    let result: CleanupResult;
    if (bindings.BUCKET) result = await cleanupR2(bindings.BUCKET, referenced, cutoff);
    else if (bindings.BLOB_READ_WRITE_TOKEN) result = await cleanupVercelBlob(bindings.BLOB_READ_WRITE_TOKEN, referenced, cutoff);
    else if (getRapidexEnvironment() !== "production" && (bindings.DATABASE_URL || bindings.POSTGRES_URL)) {
      const deletion = await db.prepare(
        `DELETE FROM media_blobs
         WHERE created_at < ?
           AND NOT EXISTS (SELECT 1 FROM products WHERE products.image_key = media_blobs.key)`,
      ).bind(cutoff).run();
      result = { ran: true, provider: "database", scanned: referenced.size, deleted: Number(deletion.meta?.changes || 0) };
    } else result = { ran: true, provider: "none", scanned: 0, deleted: 0 };

    await db.prepare(
      "UPDATE maintenance_schedules SET last_completed_at = ?, status = 'idle', detail = ? WHERE task = 'orphan_media'",
    ).bind(Date.now(), JSON.stringify(result)).run();
    return result;
  } catch (error) {
    await db.prepare(
      "UPDATE maintenance_schedules SET next_run_at = ?, status = 'failed', detail = ? WHERE task = 'orphan_media'",
    ).bind(Date.now() + 60 * 60 * 1000, safeErrorName(error)).run();
    throw error;
  }
}

async function referencedImageKeys(db: D1Database) {
  const rows = await db.prepare(
    "SELECT DISTINCT image_key FROM products WHERE image_key IS NOT NULL AND image_key <> ''",
  ).all<{ image_key: string }>();
  return new Set(rows.results.map((row) => row.image_key));
}

async function cleanupR2(bucket: R2Bucket, referenced: Set<string>, cutoff: number): Promise<CleanupResult> {
  let cursor: string | undefined;
  let scanned = 0;
  const orphanKeys: string[] = [];
  do {
    const page = await bucket.list({ prefix: "public/restaurants/", cursor, limit: 1_000 });
    for (const object of page.objects) {
      scanned += 1;
      if (object.uploaded.getTime() < cutoff && !referenced.has(object.key)) orphanKeys.push(object.key);
      if (scanned >= MAX_SCAN || orphanKeys.length >= MAX_DELETE) break;
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor && scanned < MAX_SCAN && orphanKeys.length < MAX_DELETE);
  if (orphanKeys.length) await bucket.delete(orphanKeys);
  return { ran: true, provider: "r2", scanned, deleted: orphanKeys.length };
}

async function cleanupVercelBlob(token: string, referenced: Set<string>, cutoff: number): Promise<CleanupResult> {
  let cursor: string | undefined;
  let scanned = 0;
  const orphanUrls: string[] = [];
  do {
    const page = await list({ prefix: "public/restaurants/", cursor, limit: 1_000, token });
    for (const blob of page.blobs) {
      scanned += 1;
      if (blob.uploadedAt.getTime() < cutoff && !referenced.has(blob.pathname)) orphanUrls.push(blob.url);
      if (scanned >= MAX_SCAN || orphanUrls.length >= MAX_DELETE) break;
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor && scanned < MAX_SCAN && orphanUrls.length < MAX_DELETE);
  if (orphanUrls.length) await del(orphanUrls, { token });
  return { ran: true, provider: "vercel_blob", scanned, deleted: orphanUrls.length };
}

function safeErrorName(error: unknown) {
  return error instanceof Error ? error.name.slice(0, 120) : "UnknownError";
}

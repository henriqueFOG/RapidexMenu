import { clearCommercialSession, getCommercialUser } from "@/lib/commercial-auth";
import { del, list } from "@vercel/blob";
import { apiError, assertSameOrigin, HttpError, json } from "@/lib/http";
import { getBindings, getDatabase, getRapidexEnvironment } from "@/lib/runtime";
import { classifyTenant, isSyntheticEmail } from "@/lib/tenant-classification";

export const dynamic = "force-dynamic";

type TestRestaurant = { id: string; name: string; owner_email: string };

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    if (getRapidexEnvironment() === "production") {
      throw new HttpError(404, "Rota não encontrada.", "not_found");
    }

    const user = await getCommercialUser();
    if (!user) throw new HttpError(401, "Sessão de teste ausente.", "authentication_required");
    if (!isSyntheticEmail(user.email)) {
      throw new HttpError(403, "A limpeza é exclusiva de contas sintéticas do E2E.", "test_account_required");
    }

    const db = getDatabase();
    const rows = await db.prepare(
      `SELECT id, name, owner_email FROM restaurants
       WHERE lower(owner_email) = ? ORDER BY created_at DESC`,
    ).bind(user.email).all<TestRestaurant>();
    const restaurants = rows.results.filter((restaurant) => classifyTenant({
      id: restaurant.id,
      name: restaurant.name,
      ownerEmail: restaurant.owner_email,
    }) === "test");

    const bindings = getBindings();
    const bucket = bindings.BUCKET;
    if (bucket) {
      for (const restaurant of restaurants) await deleteBucketPrefix(bucket, `public/restaurants/${restaurant.id}/`);
    } else if (bindings.BLOB_READ_WRITE_TOKEN) {
      for (const restaurant of restaurants) {
        await deleteBlobPrefix(bindings.BLOB_READ_WRITE_TOKEN, `public/restaurants/${restaurant.id}/`);
      }
    }

    const statements = restaurants.map((restaurant) =>
      db.prepare("DELETE FROM restaurants WHERE id = ? AND lower(owner_email) = ?")
        .bind(restaurant.id, user.email),
    );
    statements.push(
      db.prepare(
        `DELETE FROM app_users
         WHERE id = ?
           AND lower(email) = ?
           AND NOT EXISTS (SELECT 1 FROM platform_admins WHERE user_id = app_users.id)`,
      ).bind(user.id, user.email),
    );
    await db.batch(statements);
    await clearCommercialSession();

    return json({ ok: true, removedRestaurants: restaurants.length });
  } catch (error) {
    return apiError(error, request);
  }
}

async function deleteBucketPrefix(bucket: R2Bucket, prefix: string) {
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix, cursor });
    const keys = page.objects.map((object) => object.key);
    if (keys.length) await bucket.delete(keys);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
}

async function deleteBlobPrefix(token: string, prefix: string) {
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, cursor, token });
    if (page.blobs.length) await del(page.blobs.map((blob) => blob.url), { token });
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
}

import { requireAdminContext, requireRole } from "@/lib/admin-auth";
import { apiError, assertSameOrigin, HttpError, json } from "@/lib/http";
import { getBindings, getDatabase } from "@/lib/runtime";

const allowedTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const bucketLimit = 5 * 1024 * 1024;
const databaseLimit = 2 * 1024 * 1024;
const databaseRestaurantQuota = 30 * 1024 * 1024;

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const context = await requireAdminContext();
    requireRole(context, ["owner", "manager"]);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError(400, "Selecione uma imagem.", "validation_error");
    if (!allowedTypes[file.type]) throw new HttpError(415, "Use JPG, PNG ou WebP.", "unsupported_media");

    const bindings = getBindings();
    const bucket = bindings.BUCKET;
    const limit = bucket ? bucketLimit : databaseLimit;
    if (file.size > limit) {
      const label = bucket ? "5 MB" : "2 MB";
      throw new HttpError(413, `Imagem acima de ${label}. Reduza a foto e tente novamente.`, "file_too_large");
    }

    const key = `public/restaurants/${context.restaurantId}/products/${crypto.randomUUID()}.${allowedTypes[file.type]}`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    if (bucket) {
      await bucket.put(key, bytes, {
        httpMetadata: { contentType: file.type, cacheControl: "public, max-age=86400" },
        customMetadata: { restaurantId: context.restaurantId, uploadedBy: context.user.email },
      });
    } else {
      const db = getDatabase();
      const usage = await db
        .prepare("SELECT COALESCE(SUM(size_bytes), 0) AS total_bytes FROM media_assets WHERE restaurant_id = ?")
        .bind(context.restaurantId)
        .first<{ total_bytes: number | string }>();
      const usedBytes = Number(usage?.total_bytes || 0);
      if (usedBytes + file.size > databaseRestaurantQuota) {
        throw new HttpError(
          413,
          "Limite de fotos do piloto atingido. Remova imagens antigas ou fale com o suporte RapidexMenu.",
          "media_quota_exceeded",
        );
      }
      await db
        .prepare(
          `INSERT INTO media_assets
           (key, restaurant_id, content_type, data_base64, size_bytes, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(key, context.restaurantId, file.type, bytesToBase64(bytes), file.size, Date.now())
        .run();
    }

    return json({ ok: true, key, url: `/api/public/media/${key}` }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

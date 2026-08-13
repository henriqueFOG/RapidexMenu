import { requireAdminContext, requireRole } from "@/lib/admin-auth";
import { apiError, assertSameOrigin, HttpError, json } from "@/lib/http";
import { validateImageBytes } from "@/lib/image-validation";
import { getBindings, getDatabase, getRapidexEnvironment } from "@/lib/runtime";
import { Buffer } from "node:buffer";

const allowedTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const MAX_BUCKET_FILE_SIZE = 5 * 1024 * 1024;
const MAX_DATABASE_FILE_SIZE = 2 * 1024 * 1024;

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const context = await requireAdminContext();
    requireRole(context, ["owner", "manager"]);
    const bindings = getBindings();
    const environment = getRapidexEnvironment();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError(400, "Selecione uma imagem.", "validation_error");
    if (!allowedTypes[file.type]) throw new HttpError(415, "Use JPG, PNG ou WebP.", "unsupported_media");

    // Postgres binary storage is deliberately a development/HMG safety net only.
    // Production fails closed unless object storage is provisioned, so the
    // transactional database cannot silently become the media layer at scale.
    const postgresFallback =
      environment !== "production" &&
      !bindings.BUCKET &&
      Boolean(bindings.DATABASE_URL || bindings.POSTGRES_URL);
    const maxSize = postgresFallback ? MAX_DATABASE_FILE_SIZE : MAX_BUCKET_FILE_SIZE;
    if (file.size > maxSize) {
      throw new HttpError(
        413,
        postgresFallback ? "Imagem acima de 2 MB. Reduza o arquivo e tente novamente." : "Imagem acima de 5 MB.",
        "file_too_large",
      );
    }

    const bytes = await file.arrayBuffer();
    const validated = validateImageBytes(bytes, file.type);
    const key = `public/restaurants/${context.restaurantId}/products/${crypto.randomUUID()}.${validated.extension}`;

    if (bindings.BUCKET) {
      await bindings.BUCKET.put(key, bytes, {
        httpMetadata: { contentType: validated.mime, cacheControl: "public, max-age=86400" },
        customMetadata: {
          restaurantId: context.restaurantId,
          uploadedBy: context.user.email,
          width: String(validated.width),
          height: String(validated.height),
        },
      });
    } else if (postgresFallback) {
      await getDatabase()
        .prepare(
          `INSERT INTO media_blobs (key, restaurant_id, content_type, data_base64, size_bytes, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          key,
          context.restaurantId,
          validated.mime,
          Buffer.from(bytes).toString("base64"),
          file.size,
          Date.now(),
        )
        .run();
    } else {
      throw new HttpError(
        503,
        environment === "production"
          ? "Storage de imagens obrigatório não está configurado neste ambiente."
          : "Uploads ainda não configurados.",
        "integration_not_configured",
      );
    }

    return json({
      ok: true,
      key,
      url: `/api/public/media/${key}`,
      image: { width: validated.width, height: validated.height, type: validated.mime },
    }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

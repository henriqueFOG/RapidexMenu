import { requireAdminContext, requireRole } from "@/lib/admin-auth";
import { apiError, assertSameOrigin, HttpError, json } from "@/lib/http";
import { getBindings } from "@/lib/runtime";

const allowedTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const context = await requireAdminContext();
    requireRole(context, ["owner", "manager"]);
    const bucket = getBindings().BUCKET;
    if (!bucket) throw new HttpError(503, "Uploads ainda não configurados.", "integration_not_configured");
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError(400, "Selecione uma imagem.", "validation_error");
    if (!allowedTypes[file.type]) throw new HttpError(415, "Use JPG, PNG ou WebP.", "unsupported_media");
    if (file.size > 5 * 1024 * 1024) throw new HttpError(413, "Imagem acima de 5 MB.", "file_too_large");
    const key = `public/restaurants/${context.restaurantId}/products/${crypto.randomUUID()}.${allowedTypes[file.type]}`;
    await bucket.put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type, cacheControl: "public, max-age=86400" },
      customMetadata: { restaurantId: context.restaurantId, uploadedBy: context.user.email },
    });
    return json({ ok: true, key, url: `/api/public/media/${key}` }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

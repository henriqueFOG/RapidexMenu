import { apiError, HttpError } from "@/lib/http";
import { getBindings, getDatabase } from "@/lib/runtime";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  try {
    const key = (await params).key.join("/");
    if (!key.startsWith("public/") || key.includes("..")) {
      throw new HttpError(404, "Imagem não encontrada.", "media_not_found");
    }

    const bucket = getBindings().BUCKET;
    if (bucket) {
      const object = await bucket.get(key);
      if (!object) throw new HttpError(404, "Imagem não encontrada.", "media_not_found");
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("etag", object.httpEtag);
      headers.set("cache-control", "public, max-age=86400, immutable");
      headers.set("x-content-type-options", "nosniff");
      return new Response(object.body, { headers });
    }

    const asset = await getDatabase()
      .prepare("SELECT content_type, data_base64 FROM media_assets WHERE key = ? LIMIT 1")
      .bind(key)
      .first<{ content_type: string; data_base64: string }>();
    if (!asset) throw new HttpError(404, "Imagem não encontrada.", "media_not_found");

    const headers = new Headers({
      "content-type": asset.content_type,
      "cache-control": "public, max-age=86400, immutable",
      "x-content-type-options": "nosniff",
    });
    return new Response(base64ToBytes(asset.data_base64), { headers });
  } catch (error) {
    return apiError(error);
  }
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

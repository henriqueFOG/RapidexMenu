import { apiError, HttpError } from "@/lib/http";
import { getBindings } from "@/lib/runtime";

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
    if (!bucket) throw new HttpError(404, "Imagem não encontrada.", "media_not_found");
    const object = await bucket.get(key);
    if (!object) throw new HttpError(404, "Imagem não encontrada.", "media_not_found");
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("cache-control", "public, max-age=86400, immutable");
    headers.set("x-content-type-options", "nosniff");
    return new Response(object.body, { headers });
  } catch (error) {
    return apiError(error);
  }
}

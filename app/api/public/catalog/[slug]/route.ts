import { ensureDemoData } from "@/lib/demo-data";
import { apiError, HttpError, json } from "@/lib/http";
import { buildPublicCatalog, catalogEtag, loadPublicRestaurant } from "@/lib/public-store";
import { getDatabase } from "@/lib/runtime";
import { safeSlug } from "@/lib/validation";

export const dynamic = "force-dynamic";

const CATALOG_CACHE = "public, max-age=300, s-maxage=31536000, stale-while-revalidate=86400";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const db = getDatabase();
    await ensureDemoData(db);
    const slug = safeSlug((await params).slug);
    const restaurant = await loadPublicRestaurant(db, slug);
    const currentVersion = Number(restaurant.catalog_version || 1);
    const requestedVersionRaw = new URL(request.url).searchParams.get("v");
    if (requestedVersionRaw) {
      const requestedVersion = Number(requestedVersionRaw);
      if (!Number.isSafeInteger(requestedVersion) || requestedVersion < 1) {
        throw new HttpError(400, "Versão do cardápio inválida.", "invalid_catalog_version");
      }
      if (requestedVersion !== currentVersion) {
        throw new HttpError(409, "O cardápio mudou. Atualize a loja.", "catalog_version_changed", {
          currentVersion,
        });
      }
    }

    const etag = catalogEtag(restaurant.id, currentVersion);
    if (request.headers.get("if-none-match") === etag) {
      return new Response(null, {
        status: 304,
        headers: {
          etag,
          "cache-control": CATALOG_CACHE,
          "x-request-id": request.headers.get("x-request-id") || crypto.randomUUID(),
        },
      });
    }

    const catalog = await buildPublicCatalog(db, restaurant.id, currentVersion);
    return json({ ok: true, ...catalog }, {
      headers: {
        etag,
        "cache-control": CATALOG_CACHE,
        "x-request-id": request.headers.get("x-request-id") || crypto.randomUUID(),
      },
    });
  } catch (error) {
    return apiError(error, request);
  }
}

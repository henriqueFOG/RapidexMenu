import { ensureDemoData } from "@/lib/demo-data";
import { apiError, json } from "@/lib/http";
import { buildPublicStoreState, loadPublicRestaurant } from "@/lib/public-store";
import { getDatabase } from "@/lib/runtime";
import { safeSlug } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const db = getDatabase();
    await ensureDemoData(db);
    const slug = safeSlug((await params).slug);
    const now = Date.now();
    const restaurant = await loadPublicRestaurant(db, slug, now);
    const state = await buildPublicStoreState(db, restaurant, now);
    return json({ ok: true, restaurant: state }, {
      headers: {
        "cache-control": "no-store",
        "x-request-id": request.headers.get("x-request-id") || crypto.randomUUID(),
      },
    });
  } catch (error) {
    return apiError(error, request);
  }
}

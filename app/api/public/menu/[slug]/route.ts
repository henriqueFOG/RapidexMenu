import { ensureDemoData } from "@/lib/demo-data";
import { apiError, json } from "@/lib/http";
import { buildPublicCatalog, buildPublicStoreState, loadPublicRestaurant } from "@/lib/public-store";
import { getDatabase } from "@/lib/runtime";
import { safeSlug } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const db = getDatabase();
    await ensureDemoData(db);
    const slug = safeSlug((await params).slug);
    const now = Date.now();
    const restaurant = await loadPublicRestaurant(db, slug, now);
    const [restaurantState, catalog] = await Promise.all([
      buildPublicStoreState(db, restaurant, now),
      buildPublicCatalog(db, restaurant.id, Number(restaurant.catalog_version || 1)),
    ]);
    return json({
      ok: true,
      restaurant: restaurantState,
      categories: catalog.categories,
      uncategorized: catalog.uncategorized,
    });
  } catch (error) {
    return apiError(error);
  }
}

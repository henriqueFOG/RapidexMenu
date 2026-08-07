import { requireAdminContext, requireRole } from "@/lib/admin-auth";
import { apiError } from "@/lib/http";
import { createSellerAuthorizationUrl } from "@/lib/mercado-pago-seller";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const context = await requireAdminContext();
    requireRole(context, ["owner"]);
    const url = await createSellerAuthorizationUrl(context.restaurantId, new URL(request.url).origin);
    return Response.redirect(url, 302);
  } catch (error) {
    return apiError(error);
  }
}

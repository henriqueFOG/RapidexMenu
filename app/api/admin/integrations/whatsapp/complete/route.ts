import { audit, requireAdminContext, requireRole } from "@/lib/admin-auth";
import { requireCommercialFeature } from "@/lib/entitlements";
import { apiError, assertSameOrigin, json, readJson } from "@/lib/http";
import { completeWhatsAppEmbeddedSignup } from "@/lib/whatsapp-connection";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const context = await requireAdminContext();
    requireRole(context, ["owner"]);
    requireCommercialFeature(context, "whatsapp_connection");
    const body = await readJson<{
      code?: unknown;
      wabaId?: unknown;
      phoneNumberId?: unknown;
      businessId?: unknown;
    }>(request, 20_000);
    const connection = await completeWhatsAppEmbeddedSignup({
      restaurantId: context.restaurantId,
      code: String(body.code || ""),
      wabaId: String(body.wabaId || ""),
      phoneNumberId: String(body.phoneNumberId || ""),
      businessId: body.businessId ? String(body.businessId) : null,
    });
    await audit(context, "integration.whatsapp_connected", "restaurant", context.restaurantId, {
      wabaId: connection.wabaId,
      phoneNumberId: connection.phoneNumberId,
    });
    return json({ ok: true, connection }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

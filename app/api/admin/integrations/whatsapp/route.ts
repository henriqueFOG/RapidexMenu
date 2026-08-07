import { requireAdminContext, requireRole } from "@/lib/admin-auth";
import { apiError, assertSameOrigin, json } from "@/lib/http";
import {
  disconnectRestaurantWhatsApp,
  getRestaurantWhatsAppConnection,
  whatsappEmbeddedSignupPublicConfig,
} from "@/lib/whatsapp-connection";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const context = await requireAdminContext();
    const connection = await getRestaurantWhatsAppConnection(context.restaurantId);
    const config = whatsappEmbeddedSignupPublicConfig();
    return json({
      ok: true,
      configured: config.configured,
      connected: Boolean(connection),
      connection: connection ? {
        wabaId: connection.waba_id,
        phoneNumberId: connection.phone_number_id,
        displayPhoneNumber: connection.display_phone_number,
        verifiedName: connection.verified_name,
        status: connection.status,
      } : null,
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const context = await requireAdminContext();
    requireRole(context, ["owner"]);
    const result = await disconnectRestaurantWhatsApp(context.restaurantId);
    return json({ ok: true, ...result });
  } catch (error) {
    return apiError(error);
  }
}

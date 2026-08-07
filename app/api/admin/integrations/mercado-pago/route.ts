import { requireAdminContext, requireRole } from "@/lib/admin-auth";
import { apiError, assertSameOrigin, json } from "@/lib/http";
import { disconnectSellerMercadoPago, getSellerPaymentConnection, sellerMercadoPagoConfigured } from "@/lib/mercado-pago-seller";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const context = await requireAdminContext();
    const connection = await getSellerPaymentConnection(context.restaurantId);
    return json({
      ok: true,
      configured: sellerMercadoPagoConfigured(),
      connected: Boolean(connection),
      accountId: connection?.provider_account_id || null,
      status: connection?.status || "disconnected",
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
    await disconnectSellerMercadoPago(context.restaurantId);
    return json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}

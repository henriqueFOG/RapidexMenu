import { apiError, HttpError } from "@/lib/http";
import { completeSellerAuthorization } from "@/lib/mercado-pago-seller";
import { getBindings } from "@/lib/runtime";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code") || "";
    const state = url.searchParams.get("state") || "";
    if (!code || code.length > 500 || !state || state.length > 1000) {
      throw new HttpError(400, "Retorno de autorização inválido.", "oauth_callback_invalid");
    }
    await completeSellerAuthorization({ code, state, origin: url.origin });
    const base = getBindings().RAPIDEX_PUBLIC_URL || url.origin;
    return Response.redirect(new URL("/admin/integracoes?mercado_pago=conectado", base), 303);
  } catch (error) {
    return apiError(error);
  }
}

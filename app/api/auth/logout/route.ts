import { safeAuthReturnPath } from "@/app/chatgpt-auth";
import { clearCommercialSession } from "@/lib/commercial-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await clearCommercialSession();
  const url = new URL(request.url);
  const returnTo = safeAuthReturnPath(url.searchParams.get("return_to") || "/");
  return Response.redirect(new URL(returnTo, request.url), 303);
}

export async function POST(request: Request) {
  await clearCommercialSession();
  return Response.json({ ok: true });
}

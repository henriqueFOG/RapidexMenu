import { NextResponse } from "next/server";
import {
  createHmgSessionToken,
  HMG_SESSION_COOKIE,
  isHmgAccessConfigured,
  safeAuthReturnPath,
  verifyHmgAccessCode,
} from "@/app/chatgpt-auth";
import { apiError, assertSameOrigin } from "@/lib/http";
import { consumeRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { getDatabase } from "@/lib/runtime";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const form = await request.formData();
    const returnTo = safeAuthReturnPath(String(form.get("returnTo") || "/admin"));

    if (!isHmgAccessConfigured()) {
      return redirectToLogin(request, returnTo, "not_configured");
    }

    const limit = await consumeRateLimit(
      getDatabase(),
      await rateLimitKey(request, "hmg-login"),
      10,
      15 * 60_000,
    );
    if (!limit.allowed) return redirectToLogin(request, returnTo, "rate_limited");

    const accessCode = String(form.get("accessCode") || "");
    if (!verifyHmgAccessCode(accessCode)) {
      return redirectToLogin(request, returnTo, "invalid");
    }

    const session = await createHmgSessionToken();
    const response = NextResponse.redirect(new URL(returnTo, request.url), 303);
    response.cookies.set(HMG_SESSION_COOKIE, session.value, {
      httpOnly: true,
      secure: new URL(request.url).protocol === "https:",
      sameSite: "lax",
      path: "/",
      maxAge: session.maxAge,
    });
    return response;
  } catch (error) {
    return apiError(error);
  }
}

function redirectToLogin(request: Request, returnTo: string, error: string) {
  const url = new URL("/admin/login", request.url);
  url.searchParams.set("return_to", returnTo);
  url.searchParams.set("error", error);
  return NextResponse.redirect(url, 303);
}

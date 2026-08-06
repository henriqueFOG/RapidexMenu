import { NextResponse } from "next/server";
import {
  HMG_SESSION_COOKIE,
  safeAuthReturnPath,
} from "@/app/chatgpt-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const returnTo = safeAuthReturnPath(new URL(request.url).searchParams.get("return_to"));
  const response = NextResponse.redirect(new URL(returnTo, request.url), 303);
  response.cookies.set(HMG_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

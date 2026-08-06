import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { constantTimeEqual, hmacSha256Hex } from "@/lib/security";
import { getBindings } from "@/lib/runtime";

export type ChatGPTUser = {
  displayName: string;
  email: string;
  fullName: string | null;
};

const USER_EMAIL_HEADER = "oai-authenticated-user-email";
const USER_FULL_NAME_HEADER = "oai-authenticated-user-full-name";
const USER_FULL_NAME_ENCODING_HEADER =
  "oai-authenticated-user-full-name-encoding";
const PERCENT_ENCODED_UTF8 = "percent-encoded-utf-8";
const SIGN_IN_PATH = "/signin-with-chatgpt";
const SIGN_OUT_PATH = "/signout-with-chatgpt";
const CALLBACK_PATH = "/callback";
const HMG_SIGN_IN_PATH = "/admin/login";
const HMG_SIGN_OUT_PATH = "/api/auth/hmg/logout";
export const HMG_SESSION_COOKIE = "rapidex_hmg_session";
const HMG_SESSION_HOURS = 8;

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  if (isHmgAccessCodeAuth()) return getHmgUser();

  const requestHeaders = await headers();
  const email = requestHeaders.get(USER_EMAIL_HEADER);
  if (!email) return null;

  const encodedFullName = requestHeaders.get(USER_FULL_NAME_HEADER);
  const fullName =
    encodedFullName &&
    requestHeaders.get(USER_FULL_NAME_ENCODING_HEADER) === PERCENT_ENCODED_UTF8
      ? safeDecodeURIComponent(encodedFullName)
      : null;

  return {
    displayName: fullName ?? email,
    email,
    fullName,
  };
}

export async function requireChatGPTUser(
  returnTo: string,
): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (user) return user;

  redirect(chatGPTSignInPath(returnTo));
}

export function chatGPTSignInPath(returnTo: string): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  if (isHmgAccessCodeAuth()) {
    return `${HMG_SIGN_IN_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
  }
  return `${SIGN_IN_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

export function chatGPTSignOutPath(returnTo = "/"): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  if (isHmgAccessCodeAuth()) {
    return `${HMG_SIGN_OUT_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
  }
  return `${SIGN_OUT_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

export function isHmgAccessCodeAuth() {
  return getBindings().RAPIDEX_AUTH_MODE === "hmg-access-code";
}

export function isHmgAccessConfigured() {
  const bindings = getBindings();
  return Boolean(
    isHmgAccessCodeAuth() &&
      bindings.RAPIDEX_HMG_OWNER_EMAIL &&
      bindings.RAPIDEX_HMG_ACCESS_CODE &&
      bindings.RAPIDEX_HMG_ACCESS_CODE.length >= 16,
  );
}

export function safeAuthReturnPath(value: string | null | undefined) {
  return safeRelativeReturnPath(value || "/admin");
}

export function verifyHmgAccessCode(providedCode: string) {
  const expectedCode = getBindings().RAPIDEX_HMG_ACCESS_CODE || "";
  return expectedCode.length >= 16 && constantTimeEqual(providedCode, expectedCode);
}

export async function createHmgSessionToken() {
  const bindings = getBindings();
  const email = bindings.RAPIDEX_HMG_OWNER_EMAIL?.trim().toLowerCase();
  const secret = bindings.RAPIDEX_HMG_ACCESS_CODE;
  if (!email || !secret || secret.length < 16) {
    throw new Error("A autenticacao de HMG ainda nao foi configurada.");
  }

  const expiresAt = Date.now() + HMG_SESSION_HOURS * 60 * 60 * 1000;
  const payload = `v1.${expiresAt}`;
  const signature = await hmacSha256Hex(secret, `${payload}.${email}`);
  return {
    value: `${payload}.${signature}`,
    maxAge: HMG_SESSION_HOURS * 60 * 60,
  };
}

async function getHmgUser(): Promise<ChatGPTUser | null> {
  const bindings = getBindings();
  const email = bindings.RAPIDEX_HMG_OWNER_EMAIL?.trim().toLowerCase();
  const secret = bindings.RAPIDEX_HMG_ACCESS_CODE;
  if (!email || !secret || secret.length < 16) return null;

  const token = (await cookies()).get(HMG_SESSION_COOKIE)?.value;
  if (!token) return null;
  const [version, expiresAtRaw, providedSignature, ...extra] = token.split(".");
  if (version !== "v1" || extra.length || !expiresAtRaw || !providedSignature) return null;

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) return null;

  const expectedSignature = await hmacSha256Hex(
    secret,
    `${version}.${expiresAtRaw}.${email}`,
  );
  if (!constantTimeEqual(expectedSignature, providedSignature)) return null;

  const fullName = bindings.RAPIDEX_HMG_OWNER_NAME?.trim() || null;
  return {
    displayName: fullName || email,
    email,
    fullName,
  };
}

function safeRelativeReturnPath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";

  let url: URL;
  try {
    url = new URL(value, "https://app.local");
  } catch {
    return "/";
  }
  if (url.origin !== "https://app.local") return "/";
  if (isReservedAuthPath(url.pathname)) return "/";

  return `${url.pathname}${url.search}${url.hash}`;
}

function isReservedAuthPath(pathname: string): boolean {
  return (
    pathname === SIGN_IN_PATH ||
    pathname === SIGN_OUT_PATH ||
    pathname === CALLBACK_PATH ||
    pathname === HMG_SIGN_IN_PATH ||
    pathname === HMG_SIGN_OUT_PATH
  );
}

function safeDecodeURIComponent(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

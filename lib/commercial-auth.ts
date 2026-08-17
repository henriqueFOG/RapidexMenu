import { cookies } from "next/headers";
import { constantTimeEqual, hmacSha256Hex } from "./security";
export { hashPassword, verifyPassword } from "./password-hash";
import { publicSignupAllowed, resolveSignupMode } from "./signup-policy";
import { getBindings, getDatabase, getRapidexEnvironment } from "./runtime";

export const COMMERCIAL_SESSION_COOKIE = "rapidex_session";
const SESSION_DAYS = 7;
const encoder = new TextEncoder();

export type CommercialUser = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  authVersion: number;
};

export function isNativeAuthMode() {
  return getBindings().RAPIDEX_AUTH_MODE === "native";
}

export function nativeAuthConfigured() {
  const secret = getBindings().RAPIDEX_SESSION_SECRET || "";
  return secret.length >= 32;
}

export function signupEnabled() {
  return publicSignupAllowed(signupMode());
}

export function signupMode() {
  const bindings = getBindings();
  return resolveSignupMode({
    environment: getRapidexEnvironment(),
    configuredMode: bindings.RAPIDEX_SIGNUP_MODE,
    legacyEnabled: bindings.RAPIDEX_SIGNUP_ENABLED,
  });
}

export async function createCommercialSessionToken(user: Pick<CommercialUser, "id" | "email" | "authVersion">) {
  const secret = requireSessionSecret();
  const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const encodedEmail = base64UrlEncode(user.email.trim().toLowerCase());
  const payload = `v1.${user.id}.${user.authVersion}.${expiresAt}.${encodedEmail}`;
  const signature = await hmacSha256Hex(secret, payload);
  return { value: `${payload}.${signature}`, maxAge: SESSION_DAYS * 24 * 60 * 60 };
}

export async function setCommercialSession(user: Pick<CommercialUser, "id" | "email" | "authVersion">) {
  const session = await createCommercialSessionToken(user);
  (await cookies()).set(COMMERCIAL_SESSION_COOKIE, session.value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: session.maxAge,
  });
}

export async function clearCommercialSession() {
  (await cookies()).set(COMMERCIAL_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getCommercialUser(): Promise<CommercialUser | null> {
  if (!nativeAuthConfigured()) return null;
  const token = (await cookies()).get(COMMERCIAL_SESSION_COOKIE)?.value;
  if (!token) return null;
  const parsed = await verifyCommercialSessionToken(token);
  if (!parsed) return null;

  const row = await getDatabase()
    .prepare(
      `SELECT id, email, full_name, phone, auth_version
       FROM app_users WHERE id = ? AND lower(email) = ? AND status = 'active' LIMIT 1`,
    )
    .bind(parsed.userId, parsed.email)
    .first<{ id: string; email: string; full_name: string; phone: string | null; auth_version: number }>();
  if (!row || Number(row.auth_version) !== parsed.authVersion) return null;

  return {
    id: row.id,
    email: row.email.trim().toLowerCase(),
    fullName: row.full_name,
    phone: row.phone,
    authVersion: Number(row.auth_version),
  };
}

async function verifyCommercialSessionToken(token: string) {
  const [version, userId, authVersionRaw, expiresAtRaw, emailEncoded, signature, ...extra] = token.split(".");
  if (version !== "v1" || extra.length || !userId || !signature || !emailEncoded) return null;
  const authVersion = Number(authVersionRaw);
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isSafeInteger(authVersion) || !Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) return null;
  const email = base64UrlDecode(emailEncoded)?.trim().toLowerCase();
  if (!email) return null;
  const payload = `${version}.${userId}.${authVersionRaw}.${expiresAtRaw}.${emailEncoded}`;
  const expected = await hmacSha256Hex(requireSessionSecret(), payload);
  if (!constantTimeEqual(expected, signature.toLowerCase())) return null;
  return { userId, authVersion, expiresAt, email };
}

function requireSessionSecret() {
  const secret = getBindings().RAPIDEX_SESSION_SECRET || "";
  if (secret.length < 32) throw new Error("Configure RAPIDEX_SESSION_SECRET com pelo menos 32 caracteres.");
  return secret;
}

function base64UrlEncode(value: string) {
  const bytes = encoder.encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(padded);
    return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
  } catch {
    return null;
  }
}

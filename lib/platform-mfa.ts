import { cookies } from "next/headers";
import { constantTimeEqual, hmacSha256Hex } from "./security";
import { getBindings, getRapidexEnvironment } from "./runtime";
export { generateTotpSecret, verifyTotp } from "./totp";

export const PLATFORM_MFA_COOKIE = "rapidex_platform_mfa";
const MFA_SESSION_SECONDS = 2 * 60 * 60;
const encoder = new TextEncoder();

type MfaAdmin = { adminId: string; userId: string };

export function platformMfaRequired() {
  const bindings = getBindings();
  return getRapidexEnvironment() === "production" || bindings.RAPIDEX_ADMIN_MFA_REQUIRED === "true";
}

export function platformMfaConfigured() {
  return String(getBindings().RAPIDEX_ADMIN_MFA_SECRET || "").length >= 32;
}

export async function hasValidPlatformMfaSession(admin: MfaAdmin) {
  if (!platformMfaRequired()) return true;
  if (!platformMfaConfigured()) return false;
  const token = (await cookies()).get(PLATFORM_MFA_COOKIE)?.value;
  if (!token) return false;
  const [version, adminId, userId, expiresAtRaw, signature, ...extra] = token.split(".");
  if (version !== "v1" || extra.length || adminId !== admin.adminId || userId !== admin.userId || !signature) return false;
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) return false;
  const payload = `${version}.${adminId}.${userId}.${expiresAtRaw}`;
  const expected = await hmacSha256Hex(requireMfaKey(), payload);
  return constantTimeEqual(expected, signature.toLowerCase());
}

export async function setPlatformMfaSession(admin: MfaAdmin) {
  const expiresAt = Date.now() + MFA_SESSION_SECONDS * 1000;
  const payload = `v1.${admin.adminId}.${admin.userId}.${expiresAt}`;
  const signature = await hmacSha256Hex(requireMfaKey(), payload);
  (await cookies()).set(PLATFORM_MFA_COOKIE, `${payload}.${signature}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: MFA_SESSION_SECONDS,
  });
}

export async function clearPlatformMfaSession() {
  (await cookies()).set(PLATFORM_MFA_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}

export async function encryptMfaSecret(secret: string) {
  const key = await encryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(secret)));
  return `v1.${base64Url(iv)}.${base64Url(ciphertext)}`;
}

export async function decryptMfaSecret(value: string) {
  const [version, ivRaw, ciphertextRaw, ...extra] = value.split(".");
  if (version !== "v1" || extra.length || !ivRaw || !ciphertextRaw) throw new Error("Segredo MFA inválido.");
  const clear = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64Url(ivRaw) },
    await encryptionKey(),
    fromBase64Url(ciphertextRaw),
  );
  return new TextDecoder().decode(clear);
}

function requireMfaKey() {
  const secret = String(getBindings().RAPIDEX_ADMIN_MFA_SECRET || "");
  if (secret.length < 32) throw new Error("Configure RAPIDEX_ADMIN_MFA_SECRET com pelo menos 32 caracteres.");
  return secret;
}

async function encryptionKey() {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(requireMfaKey()));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

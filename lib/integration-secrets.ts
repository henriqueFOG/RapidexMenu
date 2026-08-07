import { getBindings } from "./runtime";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export async function encryptIntegrationSecret(value: string) {
  const key = await encryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(value));
  return `v1.${base64Url(iv)}.${base64Url(new Uint8Array(ciphertext))}`;
}

export async function decryptIntegrationSecret(value: string) {
  const [version, ivRaw, cipherRaw, ...extra] = value.split(".");
  if (version !== "v1" || extra.length || !ivRaw || !cipherRaw) throw new Error("Credencial criptografada inválida.");
  const key = await encryptionKey();
  const iv = fromBase64Url(ivRaw);
  const ciphertext = fromBase64Url(cipherRaw);
  const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(iv).buffer }, key, new Uint8Array(ciphertext).buffer);
  return decoder.decode(clear);
}

async function encryptionKey() {
  const secret = getBindings().RAPIDEX_INTEGRATION_SECRET || "";
  if (secret.length < 32) throw new Error("Configure RAPIDEX_INTEGRATION_SECRET com pelo menos 32 caracteres.");
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

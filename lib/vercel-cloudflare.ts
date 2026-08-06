/**
 * Build-time compatibility shim for the Vercel/Node runtime.
 *
 * Cloudflare injects D1/R2 through `cloudflare:workers`. Vercel exposes
 * configuration through process.env instead. The Vercel build aliases the
 * native Cloudflare module to this file so integrations keep reading their
 * secrets without bundling a protocol Node cannot resolve.
 *
 * DB and BUCKET intentionally remain absent until a Vercel-compatible
 * persistence adapter is configured. The public application still builds and
 * serves normally; database-backed endpoints fail closed instead of pretending
 * that an integration is active.
 */
export const env = process.env as Record<string, string | undefined>;

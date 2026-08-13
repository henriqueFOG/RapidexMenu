import assert from "node:assert/strict";

const baseUrl = process.env.RAPIDEX_E2E_URL || "http://127.0.0.1:3000";

for (const path of ["/", "/admin", "/api/health"]) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: "manual" });
  assert.ok(response.status >= 200 && response.status < 500, `${path} deve responder sem erro 5xx`);
  const csp = response.headers.get("content-security-policy") || "";
  assert.match(csp, /default-src 'self'/, `${path} deve ter default-src`);
  assert.match(csp, /frame-ancestors 'none'/, `${path} deve bloquear framing`);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff", `${path} deve usar nosniff`);
  assert.equal(response.headers.get("x-frame-options"), "DENY", `${path} deve usar X-Frame-Options DENY`);
  assert.equal(response.headers.get("referrer-policy"), "strict-origin-when-cross-origin", `${path} deve limitar referrer`);
  const permissions = response.headers.get("permissions-policy") || "";
  assert.match(permissions, /camera=\(\)/, `${path} deve bloquear camera por padrão`);
  assert.match(permissions, /microphone=\(\)/, `${path} deve bloquear microfone por padrão`);
  assert.match(permissions, /geolocation=\(\)/, `${path} deve bloquear geolocalização por padrão`);
}

console.log("[Security headers E2E] PASS: CSP, frame protection, referrer, permissions e nosniff");

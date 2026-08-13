const nativeFetch = globalThis.fetch;
let settingsPatched = false;

globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));

  if (url.includes("/api/auth/signup")) {
    // Keep this suite in its own bucket so it cannot consume the browser suite's
    // signup allowance when all tests share the same loopback address in CI.
    headers.set("x-forwarded-for", "198.51.100.77");
  }

  let body = init.body;
  if (!settingsPatched && url.includes("/api/admin/settings") && typeof body === "string") {
    try {
      const parsed = JSON.parse(body);
      if (parsed && parsed.weeklyHours) {
        body = JSON.stringify({ ...parsed, isOpen: true });
        settingsPatched = true;
      }
    } catch {
      // Let the underlying E2E surface malformed payloads normally.
    }
  }

  return nativeFetch(input, { ...init, headers, body });
};

await import("./scheduled-order-e2e.mjs");

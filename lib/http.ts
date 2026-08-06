export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "request_error",
    public details?: unknown,
  ) {
    super(message);
  }
}

export function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  return Response.json(data, { ...init, headers });
}

export function apiError(error: unknown) {
  if (error instanceof HttpError) {
    return json(
      { ok: false, error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status },
    );
  }

  console.error("Rapidex API error", error instanceof Error ? error.message : "unknown");
  return json(
    { ok: false, error: { code: "internal_error", message: "Não foi possível concluir agora." } },
    { status: 500 },
  );
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  if (origin !== new URL(request.url).origin) {
    throw new HttpError(403, "Origem da requisição não permitida.", "invalid_origin");
  }
}

export async function readJson<T>(request: Request, maxBytes = 100_000): Promise<T> {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > maxBytes) {
    throw new HttpError(413, "Corpo da requisição muito grande.", "payload_too_large");
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > maxBytes) {
    throw new HttpError(413, "Corpo da requisição muito grande.", "payload_too_large");
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new HttpError(400, "JSON inválido.", "invalid_json");
  }
}

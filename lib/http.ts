import { correlationId, requestCorrelationId, structuredLog } from "./observability";

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
  if (!headers.has("cache-control")) headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  if (!headers.has("x-request-id")) headers.set("x-request-id", correlationId());
  return Response.json(data, { ...init, headers });
}

export function apiError(error: unknown, request?: Request) {
  const requestId = requestCorrelationId(request);
  if (error instanceof HttpError) {
    const level = error.status >= 500 ? "error" : error.status >= 400 ? "warn" : "info";
    structuredLog(level, "api.request_error", {
      requestId,
      status: error.status,
      code: error.code,
      message: error.message,
      details: error.details,
      method: request?.method,
      path: request ? new URL(request.url).pathname : undefined,
    });
    return json(
      { ok: false, error: { code: error.code, message: error.message, details: error.details, requestId } },
      { status: error.status, headers: { "x-request-id": requestId } },
    );
  }

  if (error instanceof Error && error.message.includes("rapidex_insufficient_stock")) {
    structuredLog("warn", "api.stock_race", {
      requestId,
      method: request?.method,
      path: request ? new URL(request.url).pathname : undefined,
    });
    return json(
      {
        ok: false,
        error: {
          code: "insufficient_stock",
          message: "Um dos produtos acabou enquanto o pedido era finalizado. Atualize o cardápio e tente novamente.",
          requestId,
        },
      },
      { status: 409, headers: { "x-request-id": requestId } },
    );
  }

  structuredLog("error", "api.internal_error", {
    requestId,
    error,
    method: request?.method,
    path: request ? new URL(request.url).pathname : undefined,
  });
  return json(
    { ok: false, error: { code: "internal_error", message: "Não foi possível concluir agora.", requestId } },
    { status: 500, headers: { "x-request-id": requestId } },
  );
}

export function assertSameOrigin(request: Request) {
  const requestOrigin = new URL(request.url).origin;
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    throw new HttpError(403, "Origem da requisição não permitida.", "invalid_origin");
  }

  const origin = request.headers.get("origin");
  if (origin && origin !== requestOrigin) {
    throw new HttpError(403, "Origem da requisição não permitida.", "invalid_origin");
  }

  if (!origin) {
    const referer = request.headers.get("referer");
    if (referer) {
      let refererOrigin = "";
      try {
        refererOrigin = new URL(referer).origin;
      } catch {
        throw new HttpError(403, "Origem da requisição não permitida.", "invalid_origin");
      }
      if (refererOrigin !== requestOrigin) {
        throw new HttpError(403, "Origem da requisição não permitida.", "invalid_origin");
      }
    }
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

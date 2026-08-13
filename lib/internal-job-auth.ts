import { HttpError } from "./http";
import { reconciliationSecret } from "./runtime";
import { constantTimeEqual } from "./security";

export function authorizeInternalJob(request: Request) {
  const secret = reconciliationSecret();
  if (secret.length < 32) {
    throw new HttpError(503, "Jobs internos ainda não estão configurados.", "internal_job_not_configured");
  }
  const authorization = request.headers.get("authorization") || "";
  const provided = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!provided || !constantTimeEqual(secret, provided)) {
    throw new HttpError(401, "Acesso não autorizado.", "invalid_job_secret");
  }
}

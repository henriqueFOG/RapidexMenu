import { apiError, HttpError, json } from "@/lib/http";
import { reconcilePlatformSubscriptions } from "@/lib/platform-billing";
import { reconciliationSecret } from "@/lib/runtime";
import { constantTimeEqual } from "@/lib/security";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}

async function run(request: Request) {
  try {
    authorizeJob(request);
    const result = await reconcilePlatformSubscriptions(50);
    return json({ ok: true, ...result });
  } catch (error) {
    return apiError(error);
  }
}

function authorizeJob(request: Request) {
  const secret = reconciliationSecret();
  if (secret.length < 32) {
    throw new HttpError(503, "Reconciliação automática ainda não está configurada.", "reconciliation_not_configured");
  }
  const authorization = request.headers.get("authorization") || "";
  const provided = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!provided || !constantTimeEqual(secret, provided)) {
    throw new HttpError(401, "Acesso não autorizado.", "invalid_job_secret");
  }
}

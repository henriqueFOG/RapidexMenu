import { apiError, HttpError, json } from "@/lib/http";
import { reconcilePendingPayments } from "@/lib/reconcile-pending-payments";
import { reconciliationSecret } from "@/lib/runtime";
import { constantTimeEqual } from "@/lib/security";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  return reconcile(request);
}

export async function POST(request: Request) {
  return reconcile(request);
}

async function reconcile(request: Request) {
  try {
    authorizeJob(request);
    return json({ ok: true, ...(await reconcilePendingPayments(50)) });
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

import { processBillingDunning } from "@/lib/billing-dunning";
import { apiError, json } from "@/lib/http";
import { authorizeInternalJob } from "@/lib/internal-job-auth";
import { runJobCycle } from "@/lib/job-cycle";
import { cleanupOrphanMedia } from "@/lib/media-cleanup";
import { structuredLog } from "@/lib/observability";
import { notifyOperationalAlert } from "@/lib/operational-alerts";
import { reconcilePlatformSubscriptions } from "@/lib/platform-billing";
import { reconcilePendingPayments } from "@/lib/reconcile-pending-payments";
import { getRapidexEnvironment, reconciliationSecret } from "@/lib/runtime";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const requestId = request.headers.get("x-request-id") || crypto.randomUUID();
  const startedAt = Date.now();
  try {
    const environment = getRapidexEnvironment();
    const internalJobsConfigured = reconciliationSecret().length >= 32;

    // HMG/desenvolvimento podem manter rotinas externas desligadas sem gerar um
    // falso incidente crítico diário. Produção continua fail-closed: sem segredo,
    // authorizeInternalJob abaixo retorna 503 e aciona o alerta operacional.
    if (!internalJobsConfigured && environment !== "production") {
      structuredLog("info", "maintenance.skipped", {
        requestId,
        environment,
        reason: "internal_jobs_not_configured",
      });
      return json({
        ok: true,
        skipped: true,
        reason: "internal_jobs_not_configured",
        environment,
        durationMs: Date.now() - startedAt,
      }, {
        headers: { "x-request-id": requestId },
      });
    }

    authorizeInternalJob(request);
    structuredLog("info", "maintenance.started", { requestId });
    const [jobs, payments, subscriptions, mediaCleanup] = await Promise.all([
      runJobCycle(`maintenance:${requestId}`),
      reconcilePendingPayments(50),
      reconcilePlatformSubscriptions(50),
      cleanupOrphanMedia(),
    ]);
    const dunning = await processBillingDunning(100);
    const hasFailures = jobs.dead > 0 || payments.failed > 0 || subscriptions.failed > 0 || dunning.failed > 0;
    structuredLog(hasFailures ? "warn" : "info", "maintenance.completed", {
      requestId,
      durationMs: Date.now() - startedAt,
      jobs,
      payments: { ...payments, failures: undefined },
      subscriptions,
      dunning,
      mediaCleanup,
    });
    if (hasFailures) {
      await notifyOperationalAlert({
        event: "maintenance.degraded",
        severity: jobs.dead > 0 ? "critical" : "warning",
        summary: "O ciclo de manutenção terminou com falhas operacionais.",
        metadata: {
          jobsDead: jobs.dead,
          paymentFailures: payments.failed,
          subscriptionFailures: subscriptions.failed,
          dunningFailures: dunning.failed,
        },
      });
    }
    return json({ ok: true, jobs, payments, subscriptions, dunning, mediaCleanup, durationMs: Date.now() - startedAt }, {
      headers: { "x-request-id": requestId },
    });
  } catch (error) {
    structuredLog("error", "maintenance.failed", { requestId, durationMs: Date.now() - startedAt, error });
    await notifyOperationalAlert({
      event: "maintenance.failed",
      severity: "critical",
      summary: "O ciclo de manutenção da plataforma falhou.",
      metadata: { requestId, durationMs: Date.now() - startedAt, error },
    });
    return apiError(error, request);
  }
}

export async function POST(request: Request) {
  return GET(request);
}

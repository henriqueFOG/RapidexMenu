import { apiError, json } from "@/lib/http";
import { authorizeInternalJob } from "@/lib/internal-job-auth";
import { runJobCycle } from "@/lib/job-cycle";
import { structuredLog } from "@/lib/observability";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}

async function run(request: Request) {
  const requestId = request.headers.get("x-request-id") || crypto.randomUUID();
  try {
    authorizeInternalJob(request);
    const cycle = await runJobCycle(`cron:${requestId}`);

    structuredLog(cycle.dead ? "warn" : "info", "jobs.worker_cycle", {
      requestId,
      ...cycle,
    });
    return json({ ok: true, ...cycle }, {
      headers: { "x-request-id": requestId },
    });
  } catch (error) {
    return apiError(error, request);
  }
}

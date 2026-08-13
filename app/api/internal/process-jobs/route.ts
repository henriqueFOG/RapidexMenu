import { apiError, json } from "@/lib/http";
import { authorizeInternalJob } from "@/lib/internal-job-auth";
import { claimJob, recoverStaleJobs } from "@/lib/job-queue";
import { processClaimedJob } from "@/lib/job-worker";
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
    const workerId = `cron:${requestId}`;
    const recovered = await recoverStaleJobs();
    let claimed = 0;
    let completed = 0;
    let retried = 0;
    let dead = 0;

    for (let index = 0; index < 25; index += 1) {
      const job = await claimJob(workerId);
      if (!job) break;
      claimed += 1;
      const result = await processClaimedJob(job);
      if (result.ok) completed += 1;
      else if (result.dead) dead += 1;
      else retried += 1;
    }

    structuredLog(dead ? "warn" : "info", "jobs.worker_cycle", {
      requestId,
      recovered,
      claimed,
      completed,
      retried,
      dead,
    });
    return json({ ok: true, recovered, claimed, completed, retried, dead }, {
      headers: { "x-request-id": requestId },
    });
  } catch (error) {
    return apiError(error, request);
  }
}

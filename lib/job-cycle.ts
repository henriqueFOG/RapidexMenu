import { claimJob, recoverStaleJobs } from "./job-queue";
import { processClaimedJob } from "./job-worker";

export async function runJobCycle(workerId: string, limit = 25) {
  const recovered = await recoverStaleJobs();
  let claimed = 0;
  let completed = 0;
  let retried = 0;
  let dead = 0;
  for (let index = 0; index < limit; index += 1) {
    const job = await claimJob(workerId);
    if (!job) break;
    claimed += 1;
    const result = await processClaimedJob(job);
    if (result.ok) completed += 1;
    else if (result.dead) dead += 1;
    else retried += 1;
  }
  return { recovered, claimed, completed, retried, dead };
}

import { apiError, json } from "@/lib/http";
import { integrationReadiness, getDatabase } from "@/lib/runtime";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await getDatabase().prepare("SELECT 1 AS ok").first();
    return json({
      ok: true,
      service: "rapidexmenu",
      build: {
        sha: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || null,
        ref: process.env.VERCEL_GIT_COMMIT_REF || null,
        url: process.env.VERCEL_URL || null,
      },
      integrations: integrationReadiness(),
    });
  } catch (error) {
    return apiError(error);
  }
}

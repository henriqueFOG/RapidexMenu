import { redirect } from "next/navigation";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getPlatformAdmin } from "@/lib/platform-admin";
import JobsClient from "@/app/admin/plataforma/jobs/JobsClient";

export const dynamic = "force-dynamic";

export default async function CentralJobsPage() {
  const user = await getChatGPTUser();
  if (!user) redirect("/central/entrar");
  const admin = await getPlatformAdmin(user);
  if (!admin) redirect("/central/entrar?erro=acesso-restrito");

  return <JobsClient />;
}

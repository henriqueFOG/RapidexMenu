import { requireChatGPTUser } from "@/app/chatgpt-auth";
import ProfitClient from "./ProfitClient";

export const dynamic = "force-dynamic";

export default async function ProfitPage() {
  await requireChatGPTUser("/admin/lucro");
  return <ProfitClient />;
}

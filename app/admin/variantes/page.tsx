import { requireChatGPTUser } from "@/app/chatgpt-auth";
import VariantsClient from "./VariantsClient";

export const dynamic = "force-dynamic";

export default async function VariantsPage() {
  await requireChatGPTUser("/admin/variantes");
  return <VariantsClient />;
}

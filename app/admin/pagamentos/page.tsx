import { requireChatGPTUser } from "@/app/chatgpt-auth";
import PaymentsClient from "./PaymentsClient";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  await requireChatGPTUser("/admin/pagamentos");
  return <PaymentsClient />;
}

import { requireChatGPTUser } from "@/app/chatgpt-auth";
import BillingClient from "./BillingClient";

export const dynamic = "force-dynamic";

export default async function SubscriptionPage() {
  await requireChatGPTUser("/assinatura");
  return <BillingClient />;
}

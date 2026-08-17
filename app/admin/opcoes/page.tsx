import { requireChatGPTUser } from "@/app/chatgpt-auth";
import OptionsClient from "./OptionsClient";
import VariantsClient from "../variantes/VariantsClient";

export const dynamic = "force-dynamic";

export default async function OptionsPage() {
  await requireChatGPTUser("/admin/opcoes");
  return <>
    <VariantsClient />
    <OptionsClient />
  </>;
}

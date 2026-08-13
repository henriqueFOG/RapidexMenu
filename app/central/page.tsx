import { redirect } from "next/navigation";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getBindings } from "@/lib/runtime";
import PlatformConsoleClient from "@/app/admin/plataforma/PlatformConsoleClient";
import styles from "../commercial.module.css";

export const dynamic = "force-dynamic";

export default async function CentralPage() {
  const user = await getChatGPTUser();
  if (!user) redirect("/central/entrar");

  const ownerEmail = getBindings().RAPIDEX_OWNER_EMAIL?.trim().toLowerCase();
  if (!ownerEmail) {
    return <main className={styles.shell}><section className={styles.card} style={{ maxWidth: 620 }}>
      <small className={styles.kicker}>CENTRAL RAPIDEXMENU</small>
      <h1 className={styles.title}>Administrador geral não configurado.</h1>
      <p className={styles.intro}>Configure o e-mail proprietário da plataforma neste ambiente antes de usar a Central.</p>
    </section></main>;
  }

  if (user.email.trim().toLowerCase() !== ownerEmail) {
    redirect("/central/entrar?erro=acesso-restrito");
  }

  return <PlatformConsoleClient />;
}

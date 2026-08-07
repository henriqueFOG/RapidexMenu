import Link from "next/link";
import { requireChatGPTUser } from "@/app/chatgpt-auth";
import MenuImport from "@/app/onboarding/MenuImport";
import styles from "../../commercial.module.css";

export const dynamic = "force-dynamic";

export default async function AdminImportPage() {
  await requireChatGPTUser("/admin/importar");
  return <main className={styles.shell}><section className={styles.card} style={{ maxWidth: 980 }}>
    <Link className={styles.brand} href="/"><span>⚡</span><b>Rapidex<i>Menu</i></b></Link>
    <small className={styles.kicker}>MIGRAÇÃO E ATUALIZAÇÃO</small>
    <h1 className={styles.title}>Seu cardápio inteiro, sem cadastrar item por item.</h1>
    <p className={styles.intro}>Envie seu Excel, CSV ou copie as células direto da planilha. Você confere uma prévia antes de importar e, se o produto já existir na mesma categoria, o Rapidex atualiza os dados em vez de duplicar.</p>
    <MenuImport />
    <div className={styles.footerActions}><Link className={styles.linkButton} href="/admin">← Voltar ao painel</Link><Link className={styles.linkButton} href="/admin/categorias">Gerenciar categorias →</Link></div>
  </section></main>;
}

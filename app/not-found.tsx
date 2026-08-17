import Link from "next/link";
import styles from "./error.module.css";

export default function NotFound() {
  return <main className={styles.shell}><section className={styles.card}><div className={styles.mark}>R</div><span className={styles.code}>ERRO 404</span><h1>Esta página não foi encontrada.</h1><p>O endereço pode ter mudado ou não existir. Seus dados e pedidos não foram alterados.</p><div className={styles.actions}><Link href="/">Voltar ao início</Link><Link href="/entrar">Acessar estabelecimento</Link></div></section></main>;
}

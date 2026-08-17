"use client";

import Link from "next/link";
import { useEffect } from "react";
import styles from "./error.module.css";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(JSON.stringify({ level: "error", event: "ui.route_error", digest: error.digest || null }));
  }, [error]);
  return <main className={styles.shell}><section className={styles.card}><div className={styles.mark}>R</div><span className={styles.code}>FALHA TEMPORÁRIA</span><h1>Não foi possível abrir esta área.</h1><p>Tente novamente. Se o problema continuar, informe o código abaixo ao suporte para localizarmos a ocorrência sem expor seus dados.</p><div className={styles.actions}><button type="button" onClick={reset}>Tentar novamente</button><Link href="/">Voltar ao início</Link></div>{error.digest ? <small className={styles.request}>Código: {error.digest}</small> : null}</section></main>;
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import styles from "../../commercial.module.css";

type Connection = {
  configured: boolean;
  connected: boolean;
  accountId: string | null;
  status: string;
};

export default function PaymentsClient() {
  const [data, setData] = useState<Connection | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/admin/integrations/mercado-pago");
      const payload = await response.json() as Connection & { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "Não foi possível consultar os pagamentos.");
      setData(payload);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível consultar os pagamentos."); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function disconnect() {
    if (!window.confirm("Desconectar Mercado Pago? Novos pedidos deixarão de oferecer Pix até uma nova conexão.")) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/integrations/mercado-pago", { method: "DELETE" });
      const payload = await response.json().catch(() => ({})) as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "Não foi possível desconectar.");
      setMessage("Mercado Pago desconectado. Dinheiro e cartão na entrega continuam disponíveis.");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível desconectar."); }
    finally { setBusy(false); }
  }

  return <main className={styles.shell}><section className={styles.card} style={{ maxWidth: 760 }}>
    <Link className={styles.brand} href="/admin"><span>⚡</span><b>Rapidex<i>Menu</i></b></Link>
    <small className={styles.kicker}>RECEBIMENTOS DA SUA LOJA</small>
    <h1 className={styles.title}>O dinheiro do pedido vai direto para você.</h1>
    <p className={styles.intro}>Cada restaurante conecta a própria conta Mercado Pago. O Rapidex não usa a conta de outra loja e não mistura o recebimento dos pedidos com a cobrança da mensalidade do software.</p>
    {error && <p className={styles.error}>{error}</p>}
    {message && <p className={styles.success}>{message}</p>}

    {!data ? <section className={styles.panel}>Consultando conexão…</section> : <section className={styles.panel}>
      <h2>Mercado Pago · Pix</h2>
      {!data.configured ? <><p>A integração OAuth ainda não foi habilitada neste ambiente. Até isso acontecer, o checkout não oferece Pix e mantém apenas pagamento na entrega.</p><span className={styles.note}>Nenhuma credencial de restaurante é solicitada manualmente.</span></> : data.connected ? <>
        <p><b>✓ Conta conectada.</b> O checkout desta loja pode oferecer Pix.</p>
        {data.accountId && <p style={{ color: "#777c72" }}>Conta vinculada: final {String(data.accountId).slice(-6)}</p>}
        <button className={styles.linkButton} disabled={busy} onClick={() => void disconnect()}>{busy ? "Desconectando…" : "Desconectar Mercado Pago"}</button>
      </> : <>
        <p>Conecte sua própria conta pelo fluxo oficial do Mercado Pago. O Rapidex recebe autorização para criar e consultar os pagamentos desta loja.</p>
        <a className={styles.button} style={{ display: "block", textAlign: "center", textDecoration: "none" }} href="/api/admin/integrations/mercado-pago/connect">Conectar Mercado Pago →</a>
      </>}
    </section>}

    <section className={styles.panel}>
      <h2>Como funciona</h2>
      <div className={styles.steps}>
        <article className={styles.step}><small>01</small><strong>Você autoriza</strong><p>Login e autorização acontecem no Mercado Pago.</p></article>
        <article className={styles.step}><small>02</small><strong>Token por loja</strong><p>A autorização é armazenada criptografada e vinculada somente ao seu restaurante.</p></article>
        <article className={styles.step}><small>03</small><strong>Pix no checkout</strong><p>O Pix só aparece para o cliente quando a conexão daquela loja está ativa.</p></article>
      </div>
    </section>
    <div className={styles.footerActions}><Link className={styles.linkButton} href="/admin">← Voltar ao painel</Link><Link className={styles.linkButton} href="/admin/lucro">Lucro & ROI</Link></div>
  </section></main>;
}

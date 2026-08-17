"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import styles from "../commercial.module.css";

function SignupForm() {
  const query = useSearchParams();
  const initialPlan = ["start", "growth", "scale"].includes(query.get("plano") || "") ? query.get("plano")! : "start";
  const [busy, setBusy] = useState(false);
  const [leadBusy, setLeadBusy] = useState(false);
  const [leadSent, setLeadSent] = useState(false);
  const [error, setError] = useState("");
  const [signupMode, setSignupMode] = useState<"loading" | "open" | "invite_only" | "closed">("loading");

  useEffect(() => {
    let active = true;
    void fetch("/api/auth/signup-status", { cache: "no-store" }).then(async (response) => {
      const payload = await response.json() as { mode?: "open" | "invite_only" | "closed" };
      if (active) setSignupMode(payload.mode || "closed");
    }).catch(() => { if (active) setSignupMode("closed"); });
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ownerName: form.get("ownerName"),
          restaurantName: form.get("restaurantName"),
          email: form.get("email"),
          password: form.get("password"),
          phone: form.get("phone"),
          whatsapp: form.get("phone"),
          city: form.get("city"),
          state: form.get("state"),
          plan: form.get("plan"),
          termsAccepted: form.get("terms") === "on",
          privacyAccepted: form.get("privacy") === "on",
        }),
      });
      const payload = await response.json() as { next?: string; error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "Não foi possível criar sua conta.");
      window.location.assign(payload.next || "/onboarding");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível criar sua conta.");
      setBusy(false);
    }
  }

  async function requestInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLeadBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/public/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          restaurantName: form.get("restaurantName"),
          whatsapp: form.get("whatsapp"),
          monthlyOrdersRange: form.get("monthlyOrdersRange"),
        }),
      });
      const payload = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "Não foi possível enviar sua solicitação.");
      setLeadSent(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível enviar sua solicitação.");
    } finally {
      setLeadBusy(false);
    }
  }

  return <main className={styles.shell}>
    <section className={styles.card}>
      <Link className={styles.brand} href="/"><span>⚡</span><b>Rapidex<i>Menu</i></b></Link>
      <small className={styles.kicker}>14 DIAS GRÁTIS · SEM CARTÃO</small>
      <h1 className={styles.title}>Crie sua loja e comece a receber pedidos.</h1>
      <p className={styles.intro}>Sua conta, cardápio e painel ficam prontos em poucos minutos. Nenhuma comissão é cobrada sobre os pedidos do seu canal próprio.</p>
      {error && <p className={styles.error}>{error}</p>}
      {signupMode === "invite_only" ? <><p className={styles.success}>Estamos recebendo os primeiros estabelecimentos com acompanhamento próximo. A equipe RapidexMenu cria sua loja e envia um convite seguro para você definir a própria senha.</p>{leadSent ? <p className={styles.success}>Solicitação recebida. Vamos analisar os dados e entrar em contato pelo WhatsApp informado.</p> : <form onSubmit={requestInvite}>
        <div className={styles.grid}>
          <label className={styles.field}>Seu nome<input name="name" minLength={2} maxLength={80} required autoComplete="name" placeholder="Ex.: Mariana Silva" /></label>
          <label className={styles.field}>Nome do estabelecimento<input name="restaurantName" minLength={2} maxLength={120} required placeholder="Ex.: Burger da Serra" /></label>
          <label className={styles.field}>WhatsApp<input name="whatsapp" required inputMode="tel" autoComplete="tel" placeholder="(24) 99999-9999" /></label>
          <label className={styles.field}>Pedidos por mês<select name="monthlyOrdersRange" defaultValue=""><option value="">Prefiro não informar</option><option value="Até 300">Até 300</option><option value="301 a 1.000">301 a 1.000</option><option value="1.001 a 3.000">1.001 a 3.000</option><option value="Mais de 3.000">Mais de 3.000</option></select></label>
        </div>
        <button className={styles.button} disabled={leadBusy} style={{ marginTop: 18 }}>{leadBusy ? "Enviando…" : "Solicitar convite →"}</button>
      </form>}</> : signupMode === "closed" ? <p className={styles.error}>Novos cadastros estão temporariamente fechados. Fale com a equipe RapidexMenu.</p> : signupMode === "loading" ? <p className={styles.intro}>Verificando disponibilidade…</p> : <form onSubmit={submit}>
        <div className={styles.grid}>
          <label className={styles.field}>Seu nome<input name="ownerName" minLength={2} maxLength={120} required autoComplete="name" placeholder="Ex.: Mariana Silva" /></label>
          <label className={styles.field}>Nome do restaurante<input name="restaurantName" minLength={2} maxLength={120} required placeholder="Ex.: Burger da Serra" /></label>
          <label className={styles.field}>E-mail<input name="email" type="email" required autoComplete="email" placeholder="voce@restaurante.com.br" /></label>
          <label className={styles.field}>WhatsApp<input name="phone" required inputMode="tel" autoComplete="tel" placeholder="(24) 99999-9999" /></label>
          <label className={styles.field}>Cidade<input name="city" minLength={2} required placeholder="Petrópolis" /></label>
          <label className={styles.field}>UF<input name="state" minLength={2} maxLength={2} required placeholder="RJ" /></label>
          <label className={styles.field}>Plano após o teste<select name="plan" defaultValue={initialPlan}><option value="start">Começo · R$ 97/mês</option><option value="growth">Crescimento · R$ 297/mês</option><option value="scale">Escala · R$ 597/mês</option></select></label>
          <label className={styles.field}>Crie uma senha<input name="password" type="password" minLength={10} maxLength={128} required autoComplete="new-password" placeholder="10+ caracteres, com letra e número" /></label>
        </div>
        <div className={styles.checks}>
          <label className={styles.check}><input name="terms" type="checkbox" required /><span>Li e aceito os <Link href="/termos" target="_blank">Termos de Uso</Link>.</span></label>
          <label className={styles.check}><input name="privacy" type="checkbox" required /><span>Li a <Link href="/privacidade" target="_blank">Política de Privacidade</Link> e concordo com o tratamento dos dados para operar minha conta.</span></label>
        </div>
        <button className={styles.button} disabled={busy}>{busy ? "Criando sua loja…" : "Criar minha loja →"}</button>
      </form>}
      <Link className={styles.secondary} href="/entrar">Já tenho conta · Entrar</Link>
      {signupMode === "open" ? <p className={styles.note}>O teste começa quando sua conta é criada. Você pode cancelar antes do fim do período sem cobrança pela plataforma.</p> : null}
    </section>
  </main>;
}

export default function SignupPage() {
  return <Suspense fallback={<main className={styles.shell}><section className={styles.card}>Carregando…</section></main>}><SignupForm /></Suspense>;
}

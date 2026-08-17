"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "../../commercial.module.css";

type PublicConfig = {
  configured: boolean;
  appId: string;
  configId: string;
  solutionId: string;
  graphVersion: string;
};
type SessionInfo = { wabaId: string; phoneNumberId: string; businessId: string };
type Connection = {
  wabaId: string;
  phoneNumberId: string;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  status: string;
};
type StatusPayload = { configured: boolean; connected: boolean; connection: Connection | null; error?: { message?: string } };

type FacebookLoginResponse = { authResponse?: { code?: string } };
type FacebookSdk = {
  init: (config: { appId: string; autoLogAppEvents: boolean; xfbml: boolean; version: string }) => void;
  login: (callback: (response: FacebookLoginResponse) => void, options: Record<string, unknown>) => void;
};
declare global { interface Window { FB?: FacebookSdk; fbAsyncInit?: () => void } }

export default function WhatsAppConnectClient({ config }: { config: PublicConfig }) {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const codeRef = useRef("");
  const sessionRef = useRef<SessionInfo | null>(null);
  const completingRef = useRef(false);

  const loadStatus = useCallback(async () => {
    const response = await fetch("/api/admin/integrations/whatsapp");
    const payload = await response.json() as StatusPayload;
    if (!response.ok) throw new Error(payload.error?.message || "Não foi possível consultar o WhatsApp.");
    setStatus(payload);
  }, []);

  const complete = useCallback(async () => {
    if (completingRef.current || !codeRef.current || !sessionRef.current) return;
    completingRef.current = true;
    setBusy(true); setError(""); setMessage("Validando número e configurando webhooks…");
    try {
      const response = await fetch("/api/admin/integrations/whatsapp/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: codeRef.current,
          wabaId: sessionRef.current.wabaId,
          phoneNumberId: sessionRef.current.phoneNumberId,
          businessId: sessionRef.current.businessId || null,
        }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "Não foi possível concluir a conexão.");
      setMessage("WhatsApp conectado. Mensagens e pedidos já podem ser roteados para esta loja.");
      codeRef.current = ""; sessionRef.current = null;
      await loadStatus();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível concluir a conexão.");
      setMessage("");
    } finally {
      completingRef.current = false;
      setBusy(false);
    }
  }, [loadStatus]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadStatus().catch((reason) => setError(reason instanceof Error ? reason.message : "Falha ao carregar."));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadStatus]);

  useEffect(() => {
    if (!config.configured || !config.appId) return;
    const initialize = () => {
      if (!window.FB) return;
      window.FB.init({ appId: config.appId, autoLogAppEvents: true, xfbml: false, version: config.graphVersion });
      setSdkReady(true);
    };
    if (window.FB) { initialize(); return; }
    window.fbAsyncInit = initialize;
    let script = document.getElementById("rapidex-meta-sdk") as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = "rapidex-meta-sdk";
      script.async = true;
      script.defer = true;
      script.crossOrigin = "anonymous";
      script.src = "https://connect.facebook.net/pt_BR/sdk.js";
      script.onerror = () => setError("Não foi possível carregar a conexão da Meta.");
      document.body.appendChild(script);
    }
  }, [config]);

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (!isFacebookOrigin(event.origin) || typeof event.data !== "string") return;
      try {
        const data = JSON.parse(event.data) as {
          type?: string;
          event?: string;
          data?: { waba_id?: string; phone_number_id?: string; business_id?: string };
        };
        if (data.type !== "WA_EMBEDDED_SIGNUP") return;
        if (data.event !== "FINISH" && data.event !== "FINISH_ONLY_WABA") return;
        if (!data.data?.waba_id || !data.data?.phone_number_id) {
          setError("A Meta não retornou um número de telefone. Conclua o fluxo escolhendo/verificando o número da loja.");
          return;
        }
        sessionRef.current = {
          wabaId: data.data.waba_id,
          phoneNumberId: data.data.phone_number_id,
          businessId: data.data.business_id || "",
        };
        void complete();
      } catch {
        // O SDK também publica mensagens não JSON; elas são ignoradas por desenho.
      }
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [complete]);

  function connect() {
    setError(""); setMessage("");
    if (!window.FB || !sdkReady) { setError("A conexão da Meta ainda não está disponível no navegador."); return; }
    codeRef.current = ""; sessionRef.current = null;
    const setup = config.solutionId ? { solutionID: config.solutionId } : {};
    window.FB.login((response) => {
      const code = response.authResponse?.code || "";
      if (!code) { setError("A autorização foi cancelada ou não retornou código."); return; }
      codeRef.current = code;
      void complete();
    }, {
      config_id: config.configId,
      auth_type: "rerequest",
      response_type: "code",
      override_default_response_type: true,
      extras: { sessionInfoVersion: "3", setup },
    });
  }

  async function disconnect() {
    if (!window.confirm("Desconectar este WhatsApp do Rapidex? Novas mensagens deixarão de ser processadas pela loja.")) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/integrations/whatsapp", { method: "DELETE" });
      const payload = await response.json().catch(() => ({})) as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "Não foi possível desconectar.");
      setMessage("WhatsApp desconectado do Rapidex.");
      await loadStatus();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível desconectar."); }
    finally { setBusy(false); }
  }

  const connection = status?.connection;
  return <main className={styles.shell}><section className={styles.card} style={{ maxWidth: 850 }}>
    <Link className={styles.brand} href="/"><span>⚡</span><b>Rapidex<i>Menu</i></b></Link>
    <small className={styles.kicker}>WHATSAPP DA LOJA</small>
    <h1 className={styles.title}>{connection ? "WhatsApp conectado." : "Transforme conversa em pedido."}</h1>
    <p className={styles.intro}>A conexão usa o fluxo oficial da Meta. Você não precisa copiar token, App Secret ou Phone Number ID para o Rapidex.</p>
    {error && <p className={styles.error}>{error}</p>}
    {message && <p className={styles.success}>{message}</p>}

    {!config.configured && <section className={styles.panel}>
      <h2>Integração ainda não habilitada neste ambiente</h2>
      <p>O código do Embedded Signup está pronto, mas a plataforma precisa da aplicação Meta/Tech Provider configurada no ambiente antes de conectar lojas reais.</p>
      <p className={styles.note}>Isso exige App ID/Secret, Configuration ID do Facebook Login for Business, segredo de integração e webhook oficial. Nenhum desses segredos deve ser enviado pelo restaurante.</p>
    </section>}

    {connection ? <section className={styles.panel}>
      <h2>{connection.verifiedName || "Conta WhatsApp Business"}</h2>
      <p><b>Número:</b> {connection.displayPhoneNumber || "conectado pela Meta"}</p>
      <p><b>Status:</b> conectado · mensagens, áudio, pedidos, acompanhamento e recompra podem usar este canal.</p>
      <button className={styles.secondary} disabled={busy} onClick={() => void disconnect()}>{busy ? "Processando…" : "Desconectar WhatsApp"}</button>
    </section> : config.configured && <section className={styles.panel}>
      <h2>Conectar minha conta</h2>
      <p>O popup da Meta permite escolher/criar a conta WhatsApp Business e verificar o número. Depois, o Rapidex valida os ativos novamente no servidor antes de ativar.</p>
      <button className={styles.button} disabled={busy || !sdkReady} onClick={connect}>{busy ? "Conectando…" : sdkReady ? "Conectar com a Meta →" : "Carregando Meta…"}</button>
    </section>}

    <section className={styles.panel}>
      <h2>O que acontece depois</h2>
      <div className={styles.steps}>
        <article className={styles.step}><small>01</small><strong>Atendimento</strong><p>Texto e áudio entram na conversa da loja correta.</p></article>
        <article className={styles.step}><small>02</small><strong>Pedido completo</strong><p>Carrinho, endereço e pagamento são coletados; o servidor recalcula tudo antes do CONFIRMAR.</p></article>
        <article className={styles.step}><small>03</small><strong>Pós-venda</strong><p>Status, acompanhamento e “pedir de novo” continuam no WhatsApp.</p></article>
      </div>
    </section>
    <div className={styles.footerActions}><Link className={styles.linkButton} href="/admin">← Voltar ao painel</Link></div>
  </section></main>;
}

function isFacebookOrigin(origin: string) {
  try {
    const hostname = new URL(origin).hostname.toLowerCase();
    return hostname === "facebook.com" || hostname.endsWith(".facebook.com");
  } catch { return false; }
}

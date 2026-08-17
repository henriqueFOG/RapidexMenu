"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "../../commercial.module.css";

type Customer = {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  whatsapp_consent: number | boolean;
  marketing_opt_out_at?: number | null;
  order_count: number;
  lifetime_value_cents: number;
  last_order_at?: number | null;
};
type PrivacyRequest = {
  id: string;
  customer_id: string | null;
  request_type: string;
  status: string;
  requester_reference?: string | null;
  requested_at: number;
  completed_at?: number | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
};

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export default function PrivacyClient() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [requests, setRequests] = useState<PrivacyRequest[]>([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/admin/privacy");
      const payload = await response.json() as { customers?: Customer[]; requests?: PrivacyRequest[]; error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "Não foi possível carregar privacidade.");
      setCustomers(payload.customers || []);
      setRequests(payload.requests || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar privacidade.");
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const filteredCustomers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return customers.slice(0, 50);
    return customers.filter((customer) => `${customer.name} ${customer.phone} ${customer.email || ""}`.toLowerCase().includes(term)).slice(0, 50);
  }, [customers, search]);

  async function customerAction(customer: Customer, action: "opt_out" | "deletion_request" | "access_request") {
    const destructive = action === "deletion_request";
    if (destructive && !window.confirm(`Registrar pedido de eliminação para ${customer.name}? O sistema NÃO apagará o histórico automaticamente.`)) return;
    setBusy(`${customer.id}:${action}`); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/admin/customers/${encodeURIComponent(customer.id)}/privacy`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, requesterReference: "registrado pelo painel do restaurante" }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "Não foi possível registrar a ação.");
      setMessage(action === "opt_out" ? "Opt-out aplicado imediatamente." : "Solicitação registrada na fila de privacidade.");
      await load();
    } catch (reason) { setError(errorMessage(reason)); } finally { setBusy(""); }
  }

  async function exportCustomer(customer: Customer) {
    setBusy(`${customer.id}:export`); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/admin/customers/${encodeURIComponent(customer.id)}/privacy`);
      const payload = await response.json() as { export?: unknown; error?: { message?: string } };
      if (!response.ok || !payload.export) throw new Error(payload.error?.message || "Não foi possível exportar os dados.");
      const blob = new Blob([JSON.stringify(payload.export, null, 2)], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `rapidex-dados-${customer.id}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage("Exportação gerada e auditada.");
    } catch (reason) { setError(errorMessage(reason)); } finally { setBusy(""); }
  }

  async function updateRequest(request: PrivacyRequest, status: "in_review" | "completed" | "rejected") {
    const note = window.prompt("Nota operacional (opcional)", "") || "";
    setBusy(`request:${request.id}`); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/admin/privacy/${encodeURIComponent(request.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, note }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "Não foi possível atualizar a solicitação.");
      setMessage("Solicitação atualizada.");
      await load();
    } catch (reason) { setError(errorMessage(reason)); } finally { setBusy(""); }
  }

  return <main className={styles.shell}><section className={styles.card} style={{ maxWidth: 1120 }}>
    <Link className={styles.brand} href="/admin"><span>⚡</span><b>Rapidex<i>Menu</i></b></Link>
    <small className={styles.kicker}>PRIVACIDADE / LGPD</small>
    <h1 className={styles.title}>Solicitações e direitos do titular</h1>
    <p className={styles.intro}>Exporte dados, aplique opt-out e registre solicitações. Pedidos de eliminação entram em análise: o sistema não apaga automaticamente histórico que possa estar sujeito a retenção fiscal, contratual ou de defesa.</p>
    {error && <p className={styles.error}>{error}</p>}{message && <p className={styles.success}>{message}</p>}

    <section className={styles.panel}>
      <h2>Fila de solicitações</h2>
      <div style={{ display: "grid", gap: 10 }}>
        {requests.length ? requests.map((request) => <div key={request.id} style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 14, display: "grid", gridTemplateColumns: "1fr auto", gap: 14 }}>
          <div><b>{requestLabel(request.request_type)} · {request.customer_name || "Cliente"}</b><small style={{ display: "block" }}>{request.customer_phone || request.customer_email || request.customer_id || "sem referência"} · {dateTime.format(new Date(request.requested_at))}</small><small style={{ display: "block" }}>Status: <b>{request.status}</b></small></div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            {request.status === "pending" && <button disabled={Boolean(busy)} onClick={() => void updateRequest(request, "in_review")}>Em análise</button>}
            {request.status !== "completed" && request.status !== "rejected" && request.request_type !== "deletion" && <button disabled={Boolean(busy)} onClick={() => void updateRequest(request, "completed")}>Concluir</button>}
            {request.status !== "completed" && request.status !== "rejected" && <button disabled={Boolean(busy)} onClick={() => void updateRequest(request, "rejected")}>Rejeitar c/ motivo</button>}
          </div>
        </div>) : <p>Nenhuma solicitação registrada.</p>}
      </div>
    </section>

    <section className={styles.panel}>
      <h2>Clientes</h2>
      <label className={styles.field}>Buscar por nome, telefone ou e-mail<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Digite para localizar" /></label>
      <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
        {filteredCustomers.map((customer) => <div key={customer.id} style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 14, display: "grid", gridTemplateColumns: "minmax(220px,1fr) auto", gap: 14 }}>
          <div><b>{customer.name}</b><small style={{ display: "block" }}>{customer.phone}{customer.email ? ` · ${customer.email}` : ""}</small><small style={{ display: "block" }}>{customer.order_count || 0} pedidos · {currency.format(Number(customer.lifetime_value_cents || 0) / 100)} · marketing: {customer.whatsapp_consent ? "consentido" : "não consentido"}</small></div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "flex-end" }}>
            <button disabled={Boolean(busy)} onClick={() => void exportCustomer(customer)}>Exportar</button>
            <button disabled={Boolean(busy)} onClick={() => void customerAction(customer, "access_request")}>Registrar acesso</button>
            <button disabled={Boolean(busy) || !customer.whatsapp_consent} onClick={() => void customerAction(customer, "opt_out")}>Opt-out</button>
            <button disabled={Boolean(busy)} onClick={() => void customerAction(customer, "deletion_request")}>Pedir eliminação</button>
          </div>
        </div>)}
      </div>
    </section>
    <div className={styles.footerActions}><Link className={styles.linkButton} href="/admin">← Voltar ao painel</Link></div>
  </section></main>;
}

function requestLabel(value: string) {
  return ({ access: "Acesso", correction: "Correção", opt_out: "Opt-out", deletion: "Eliminação", portability: "Portabilidade" } as Record<string, string>)[value] || value;
}
function errorMessage(reason: unknown) { return reason instanceof Error ? reason.message : "Não foi possível concluir."; }

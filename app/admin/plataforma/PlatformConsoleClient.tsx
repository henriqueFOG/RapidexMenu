"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "../../commercial.module.css";

type Integration = { provider:string; status:string };
type Restaurant = {
  id:string; name:string; slug:string; plan:string; status:string; published:boolean; createdAt:number;
  firstOrderAt:number|null; activatedWithin48h:boolean; trialEndsAt:number|null; accessEndsAt:number|null;
  subscription:{plan:string;amountCents:number;status:string}|null; integrations:Integration[];
};
type Overview = {
  metrics:{restaurants:number;published:number;activated:number;activationRate:number;activation48hRate:number;trials:number;trialsExpiring72h:number;payingRestaurants:number;mrrCents:number;arrRunRateCents:number;has30dSubscriptionHistory:boolean;newMrr30dCents:number;expansionMrr30dCents:number;contractionMrr30dCents:number;churnMrr30dCents:number;nrr30d:number|null;logoChurn30d:number|null};
  operations:{jobsQueued:number;jobsRunning:number;jobsRetry:number;jobsDead:number;failedWebhooks24h:number;stalePendingPayments:number;dunningFailed:number;dunningSending:number;aiResponsesToday:number;aiTranscriptionsToday:number;aiInputTokensToday:number;aiOutputTokensToday:number};
  restaurants:Restaurant[];
};
type Health = {build?:{sha?:string|null;ref?:string|null};integrations?:Record<string,unknown> & {environment?:string;environmentSafe?:boolean;database?:boolean;databaseEngine?:string|null;nativeAuth?:boolean;uploads?:boolean;billing?:boolean;email?:boolean;sellerPayments?:boolean;reconciliation?:boolean;metaEmbeddedSignup?:boolean;openai?:boolean;whatsapp?:boolean}};
type Tab="resumo"|"restaurantes"|"receita"|"operacao"|"infra";

const money=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"});
const dateTime=new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short"});
const num=new Intl.NumberFormat("pt-BR");

export default function PlatformConsoleClient(){
  const [data,setData]=useState<Overview|null>(null);
  const [health,setHealth]=useState<Health|null>(null);
  const [tab,setTab]=useState<Tab>("resumo");
  const [query,setQuery]=useState("");
  const [status,setStatus]=useState("all");
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);

  async function load(){
    setLoading(true);setError("");
    try{
      const [a,b]=await Promise.all([fetch("/api/internal/platform/overview",{cache:"no-store"}),fetch("/api/health",{cache:"no-store"})]);
      const overview=await a.json() as Overview & {error?:{message?:string}};
      const healthPayload=await b.json() as Health;
      if(!a.ok) throw new Error(overview.error?.message||"Não foi possível carregar a central administrativa.");
      setData(overview);setHealth(healthPayload);
    }catch(reason){setError(reason instanceof Error?reason.message:"Falha ao carregar a central administrativa.");}
    finally{setLoading(false);}
  }
  useEffect(()=>{void load();},[]);

  const filtered=useMemo(()=>{
    if(!data)return[];
    const term=query.trim().toLowerCase();
    return data.restaurants.filter(r=>(status==="all"||r.status===status)&&(!term||`${r.name} ${r.slug} ${r.plan}`.toLowerCase().includes(term)));
  },[data,query,status]);

  if(loading&&!data)return <main className={styles.shell}><section className={styles.card}>Carregando central administrativa…</section></main>;
  if(!data)return <main className={styles.shell}><section className={styles.card}><p className={styles.error}>{error||"Dados indisponíveis."}</p></section></main>;

  const m=data.metrics,o=data.operations,ready=health?.integrations;
  const risks=o.jobsDead+o.failedWebhooks24h+o.stalePendingPayments+o.dunningFailed;

  return <main className={styles.shell}><section className={styles.card} style={{maxWidth:1280}}>
    <div style={{display:"flex",justifyContent:"space-between",gap:20,flexWrap:"wrap"}}>
      <div><Link className={styles.brand} href="/"><span>⚡</span><b>Rapidex<i>Menu</i></b></Link><small className={styles.kicker}>ADMINISTRAÇÃO DA PLATAFORMA</small><h1 className={styles.title}>Central de gerenciamento</h1><p className={styles.intro}>Controle executivo, comercial, operacional e técnico do SaaS em um único lugar. Segredos e credenciais nunca aparecem nesta tela.</p></div>
      <button onClick={()=>void load()} disabled={loading} style={button}>{loading?"Atualizando…":"↻ Atualizar"}</button>
    </div>

    <nav style={{display:"flex",gap:8,flexWrap:"wrap",margin:"22px 0",paddingBottom:12,borderBottom:"1px solid #e5e5e5"}}>
      <TabButton active={tab==="resumo"} click={()=>setTab("resumo")}>Visão geral</TabButton><TabButton active={tab==="restaurantes"} click={()=>setTab("restaurantes")}>Restaurantes</TabButton><TabButton active={tab==="receita"} click={()=>setTab("receita")}>Receita</TabButton><TabButton active={tab==="operacao"} click={()=>setTab("operacao")}>Operação</TabButton><TabButton active={tab==="infra"} click={()=>setTab("infra")}>Infraestrutura</TabButton>
    </nav>

    {tab==="resumo"&&<><div style={grid}><Metric label="Restaurantes" value={String(m.restaurants)} note={`${m.published} publicados`}/><Metric label="Ativação" value={`${m.activationRate}%`} note={`${m.activated} com primeiro pedido`}/><Metric label="Pagantes" value={String(m.payingRestaurants)} note={`${m.trials} em trial`}/><Metric label="MRR" value={money.format(m.mrrCents/100)} note={`ARR ${money.format(m.arrRunRateCents/100)}`}/><Metric label="Riscos" value={String(risks)} note={risks?"exigem atenção":"operação saudável"}/><Metric label="Ambiente" value={String(ready?.environment||"—")} note={ready?.environmentSafe?"configuração segura":"revisar configuração"}/></div><section className={styles.panel}><h2>Acesso rápido</h2><div style={{display:"flex",gap:10,flexWrap:"wrap"}}><Link className={styles.linkButton} href="/admin/plataforma/jobs">Fila e DLQ</Link><Link className={styles.linkButton} href="/assinatura">Assinaturas</Link><Link className={styles.linkButton} href="/admin">Painel de restaurante</Link></div></section></>}

    {tab==="restaurantes"&&<section className={styles.panel}><h2>Restaurantes</h2><p>Acompanhe onboarding, publicação, trial, ativação, plano e integrações de cada cliente.</p><div style={{display:"grid",gridTemplateColumns:"minmax(220px,1fr) 180px",gap:10,margin:"14px 0"}}><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar restaurante…" style={input}/><select value={status} onChange={e=>setStatus(e.target.value)} style={input}><option value="all">Todos</option><option value="trial">Trial</option><option value="active">Ativo</option><option value="paused">Pausado</option><option value="canceled">Cancelado</option></select></div><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:980}}><thead><tr><Th>Loja</Th><Th>Plano/status</Th><Th>Ativação</Th><Th>Assinatura</Th><Th>Integrações</Th><Th>Trial/acesso</Th><Th></Th></tr></thead><tbody>{filtered.map(r=><tr key={r.id} style={{borderTop:"1px solid #e8e8e8"}}><Td><b>{r.name}</b><small style={sub}>/{r.slug} · {r.published?"publicada":"não publicada"}</small></Td><Td><b>{r.plan}</b><small style={sub}>{r.status}</small></Td><Td>{r.firstOrderAt?<><b>{r.activatedWithin48h?"≤48h":">48h"}</b><small style={sub}>{dateTime.format(new Date(r.firstOrderAt))}</small></>:<b>Sem pedido</b>}</Td><Td>{r.subscription?<><b>{money.format(r.subscription.amountCents/100)}/mês</b><small style={sub}>{r.subscription.status}</small></>:"Sem assinatura"}</Td><Td>{r.integrations.length?r.integrations.map(i=><small key={i.provider} style={{display:"block"}}>{i.provider}: <b>{i.status}</b></small>):"—"}</Td><Td><small style={{display:"block"}}>Trial: {r.trialEndsAt?dateTime.format(new Date(r.trialEndsAt)):"—"}</small><small style={{display:"block"}}>Acesso: {r.accessEndsAt?dateTime.format(new Date(r.accessEndsAt)):"—"}</small></Td><Td><Link href={`/loja/${r.slug}`} target="_blank">Abrir ↗</Link></Td></tr>)}</tbody></table></div><small>{filtered.length} resultado(s)</small></section>}

    {tab==="receita"&&<><section className={styles.panel}><h2>Receita recorrente</h2><div style={grid}><Metric label="MRR" value={money.format(m.mrrCents/100)} note={`${m.payingRestaurants} clientes`}/><Metric label="ARR run-rate" value={money.format(m.arrRunRateCents/100)} note="MRR × 12"/><Metric label="New MRR · 30d" value={money.format(m.newMrr30dCents/100)} note="nova receita"/><Metric label="Expansion · 30d" value={money.format(m.expansionMrr30dCents/100)} note="expansão"/><Metric label="Contraction · 30d" value={money.format(m.contractionMrr30dCents/100)} note="redução"/><Metric label="Churned · 30d" value={money.format(m.churnMrr30dCents/100)} note="receita perdida"/></div></section><section className={styles.panel}><h2>Retenção</h2><div style={grid}><Metric label="NRR" value={m.nrr30d===null?"Formando janela":`${m.nrr30d}%`} note="retenção líquida"/><Metric label="Logo churn" value={m.logoChurn30d===null?"Formando janela":`${m.logoChurn30d}%`} note="clientes perdidos"/><Metric label="Ativação ≤48h" value={`${m.activation48hRate}%`} note="time-to-value"/><Metric label="Trials vencendo" value={String(m.trialsExpiring72h)} note="próximas 72h"/></div></section></>}

    {tab==="operacao"&&<section className={styles.panel}><h2>Operação e incidentes</h2><div style={grid}><Metric label="Jobs ativos" value={num.format(o.jobsQueued+o.jobsRunning)} note={`${o.jobsRetry} retry · ${o.jobsDead} DLQ`}/><Metric label="Webhooks falhos" value={String(o.failedWebhooks24h)} note="24 horas"/><Metric label="Pagamentos pendentes" value={String(o.stalePendingPayments)} note="> 30 min"/><Metric label="Dunning" value={String(o.dunningSending)} note={`${o.dunningFailed} falho(s)`}/><Metric label="IA hoje" value={num.format(o.aiResponsesToday)} note={`${num.format(o.aiTranscriptionsToday)} transcrições`}/><Metric label="Tokens IA" value={num.format(o.aiInputTokensToday+o.aiOutputTokensToday)} note="consumo de hoje"/></div><div className={styles.footerActions}><Link className={styles.linkButton} href="/admin/plataforma/jobs">Abrir fila e DLQ →</Link></div></section>}

    {tab==="infra"&&<><section className={styles.panel}><h2>Infraestrutura</h2><div style={grid}><Metric label="Banco" value={ready?.database?String(ready.databaseEngine||"conectado"):"Indisponível"} note="conexão da aplicação"/><Metric label="Build" value={health?.build?.sha?health.build.sha.slice(0,8):"—"} note={health?.build?.ref||"ref indisponível"}/><Metric label="Autenticação" value={ready?.nativeAuth?"Pronta":"Pendente"} note="sessões comerciais"/><Metric label="Uploads" value={ready?.uploads?"Prontos":"Pendentes"} note="mídia"/></div></section><section className={styles.panel}><h2>Integrações</h2><div style={grid}><Flag label="Billing" value={ready?.billing}/><Flag label="E-mail" value={ready?.email}/><Flag label="Pix vendedor" value={ready?.sellerPayments}/><Flag label="Reconciliação" value={ready?.reconciliation}/><Flag label="Meta" value={ready?.metaEmbeddedSignup}/><Flag label="OpenAI" value={ready?.openai}/><Flag label="WhatsApp" value={ready?.whatsapp}/></div></section></>}

    {error&&<p className={styles.error}>{error}</p>}
  </section></main>;
}

function Metric({label,value,note}:{label:string;value:string;note:string}){return <div style={card}><small style={{fontWeight:900}}>{label}</small><strong style={{display:"block",fontSize:24,margin:"5px 0"}}>{value}</strong><span style={{fontSize:12,color:"#6d716a"}}>{note}</span></div>}
function Flag({label,value}:{label:string;value:unknown}){return <Metric label={label} value={value?"✓ Configurado":"○ Pendente"} note="status do ambiente"/>}
function TabButton({active,click,children}:{active:boolean;click:()=>void;children:React.ReactNode}){return <button onClick={click} style={{...button,background:active?"#191b18":"#fff",color:active?"#fff":"#191b18"}}>{children}</button>}
function Th({children}:{children:React.ReactNode}){return <th style={{textAlign:"left",padding:"10px 8px",fontSize:12}}>{children}</th>}
function Td({children}:{children:React.ReactNode}){return <td style={{padding:"12px 8px",verticalAlign:"top",fontSize:13}}>{children}</td>}
const grid={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,margin:"18px 0"} as const;
const card={border:"1px solid #e5e5e5",borderRadius:14,padding:16,background:"#fff"} as const;
const button={border:"1px solid #d8d8d8",borderRadius:999,padding:"10px 14px",background:"#fff",fontWeight:900,cursor:"pointer"} as const;
const input={border:"1px solid #d8d8d8",borderRadius:12,padding:"11px 12px",background:"#fff",font:"inherit"} as const;
const sub={display:"block",color:"#6d716a",marginTop:3} as const;

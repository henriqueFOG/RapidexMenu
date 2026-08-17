"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import styles from "./RapidexLanding.module.css";

type IconName = "store" | "clipboard" | "rocket" | "dashboard" | "shield" | "link" | "chart" | "clock" | "smile" | "report" | "check";

function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  const p = { width:size, height:size, viewBox:"0 0 24 24", fill:"none", stroke:"currentColor", strokeWidth:1.8, strokeLinecap:"round" as const, strokeLinejoin:"round" as const, "aria-hidden":true };
  switch (name) {
    case "store": return <svg {...p}><path d="M4 10v9h16v-9M3 10l2-5h14l2 5M9 19v-5h6v5"/><path d="M3 10c0 1.1.9 2 2 2s2-.9 2-2c0 1.1.9 2 2 2s2-.9 2-2c0 1.1.9 2 2 2s2-.9 2-2c0 1.1.9 2 2 2s2-.9 2-2"/></svg>;
    case "clipboard": return <svg {...p}><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M8 9h8M8 13h8M8 17h5"/></svg>;
    case "rocket": return <svg {...p}><path d="M14 5c3-2 5-2 5-2s0 2-2 5l-5 5-4-4 6-4ZM8 9l-3 1-2 3 5-1M12 13l-1 5-3 2 1-5"/><circle cx="14.5" cy="7.5" r="1.3"/></svg>;
    case "dashboard": return <svg {...p}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 15l3-3 2 2 5-6M7 8h3"/></svg>;
    case "shield": return <svg {...p}><path d="M12 3 5 6v5c0 4.5 3 7.5 7 10 4-2.5 7-5.5 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></svg>;
    case "link": return <svg {...p}><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.2 1.2M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.2-1.2"/></svg>;
    case "chart": return <svg {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2M4 8l5-4 4 5 7-5"/></svg>;
    case "clock": return <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    case "smile": return <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M8.5 10h.01M15.5 10h.01M8 14c1 2 2.5 3 4 3s3-1 4-3"/></svg>;
    case "report": return <svg {...p}><path d="M5 3h14v18H5zM8 16v-3M12 16V9M16 16v-5"/></svg>;
    default: return <svg {...p}><path d="m5 12 4 4L19 6"/></svg>;
  }
}

function Logo() {
  return <span className={styles.logo} aria-label="RapidexMenu"><svg viewBox="0 0 70 42" aria-hidden="true"><path d="M15 30h42M19 27c1-11 8-18 17-18s16 7 17 18H19ZM36 9V5M32 5h8M9 19h7M5 24h10M10 29h7M20 34h34"/></svg><b>RAPIDEX<span>MENU</span></b></span>;
}

const benefits: Array<[IconName,string,string]> = [
  ["chart","Mais oportunidades","para vender no canal próprio"],
  ["clipboard","Mais praticidade","para organizar a operação"],
  ["clock","Atendimento mais","rápido e eficiente"],
  ["smile","Clientes mais","bem atendidos"],
];
const steps: Array<[IconName,string,string]> = [
  ["store","Cadastre seu restaurante","É rápido e fácil"],
  ["clipboard","Monte seu cardápio","Adicione produtos, fotos e preços"],
  ["rocket","Publique e compartilhe","Seu cardápio fica pronto para receber pedidos"],
  ["dashboard","Receba pedidos e venda mais","Gerencie tudo em um só lugar"],
];
const plans = [
  {name:"Começo",slug:"start",price:"97",desc:"Para organizar o canal próprio e começar a vender direto.",items:["Cardápio, link e QR Code","Gestor de pedidos","Pagamento na entrega","Pix após conexão da conta","Relatórios essenciais"]},
  {name:"Crescimento",slug:"growth",price:"297",desc:"Para vender no automático e trazer clientes de volta.",featured:true,items:["Tudo do plano Começo","WhatsApp e IA após ativação","Memória de preferências","Recuperação e recompra","Guardião de margem"]},
  {name:"Escala",slug:"scale",price:"597",desc:"Para operações com mais volume, equipe e controle operacional.",items:["Tudo do Crescimento","KDS de cozinha","Controles avançados de operação","Integrações e permissões","Suporte prioritário"]},
];

export default function RapidexLanding() {
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);
  return <main className={styles.landing}>
    <section className={styles.hero} id="inicio">
      <header className={styles.header}>
        <a href="#inicio" onClick={close}><Logo/></a>
        <nav className={menuOpen ? styles.navOpen : ""}>
          <a className={styles.active} href="#inicio" onClick={close}>Início</a>
          <a href="#como-funciona" onClick={close}>Como funciona</a>
          <a href="#para-restaurantes" onClick={close}>Para restaurantes</a>
          <a href="#planos" onClick={close}>Planos</a>
          <a href="#contato" onClick={close}>Contato</a>
          <div className={styles.mobileActions}><Link href="/loja/serra-burger">Experimentar em tempo real</Link><Link href="/entrar">Acessar painel</Link></div>
        </nav>
        <div className={styles.headerActions}>
          <Link className={styles.liveButton} href="/loja/serra-burger">Experimentar em tempo real</Link>
          <Link className={styles.panelButton} href="/entrar">Acessar Painel</Link>
          <button className={styles.mobileMenu} onClick={() => setMenuOpen(v => !v)} aria-label="Abrir menu">{menuOpen ? "✕" : "☰"}</button>
        </div>
      </header>

      <div className={styles.heroInner}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>PLATAFORMA COMPLETA PARA RESTAURANTES</span>
          <h1>Cardápio Online.<br/>Pedidos. Entrega.<br/><span>Simples assim.</span></h1>
          <p>A plataforma completa para restaurantes que querem vender mais, organizar pedidos e encantar clientes.</p>
          <div className={styles.heroCtas}>
            <Link className={styles.primaryCta} href="/loja/serra-burger">Experimentar em tempo real <span>→</span></Link>
            <Link className={styles.secondaryCta} href="/demo/painel"><span className={styles.play}>▣</span> Ver painel funcionando</Link>
          </div>
          <div className={styles.heroFeatures}>
            <div><span><Icon name="dashboard"/></span><p><b>0% comissão</b><small>por pedido</small></p></div>
            <div><span><Icon name="shield"/></span><p><b>Cardápio 100%</b><small>personalizado</small></p></div>
            <div><span><Icon name="link"/></span><p><b>Pedidos via site</b><small>e integrações opcionais</small></p></div>
            <div><span><Icon name="report"/></span><p><b>Relatórios e controle</b><small>na palma da mão</small></p></div>
          </div>
        </div>

        <div className={styles.heroVisual}>
          <Image className={styles.burgerPhoto} src="https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1100&q=92" width={1100} height={825} sizes="(max-width: 760px) 90vw, 55vw" unoptimized alt="Hambúrguer artesanal"/>
          <Link className={styles.phoneLink} href="/loja/serra-burger" aria-label="Experimentar cardápio em tempo real">
            <div className={styles.phoneMock}>
              <div className={styles.phoneBar}><span>3:03</span><i>● ● ●</i></div>
              <div className={styles.phoneRestaurant}><div><b>Sabor &amp; Arte</b><small>Restaurante</small><em>Aberto agora até 23:00</em></div><span>🍕</span></div>
              <div className={styles.phoneDelivery}>● Entrega · 30–50 min · R$ 5,00</div>
              <h3>Destaques</h3>
              {[["🍔","X-Burguer Artesanal","Pão brioche, 180g de carne, queijo cheddar, alface, tomate e molho especial.","R$ 29,90"],["🍕","Pizza Calabresa","Massa artesanal, molho de tomate, mussarela e calabresa.","R$ 34,90"],["🥤","Combo Família","2 pizzas grandes + refrigerante 2L grátis","R$ 89,90"]].map(x => <article key={x[1]}><span>{x[0]}</span><div><b>{x[1]}</b><small>{x[2]}</small><strong>{x[3]}</strong></div><i>+</i></article>)}
              <footer><span>⌂<small>Início</small></span><span>▱<small>Cardápio</small></span><span>▤<small>Meu pedido</small></span><span>♙<small>Conta</small></span></footer>
            </div>
          </Link>
        </div>
      </div>
    </section>

    <section className={styles.proofBand}><h2>Seu canal próprio pronto para vender mais com o RapidexMenu</h2><div>{benefits.map(([icon,title,text]) => <article key={title}><span><Icon name={icon}/></span><p><b>{title}</b><small>{text}</small></p></article>)}</div></section>

    <section className={styles.restaurantSection} id="para-restaurantes">
      <div className={styles.restaurantCopy}><span className={styles.sectionKicker}>GESTÃO QUE ACOMPANHA O SEU RITMO</span><h2>Para restaurantes que querem <span>crescer de verdade</span></h2><p>Ferramentas completas para facilitar sua rotina, encantar seus clientes e aumentar suas vendas.</p><ul><li><Icon name="check"/> Cardápio online personalizado</li><li><Icon name="check"/> Pedidos via site e QR Code</li><li><Icon name="check"/> Gestão de pedidos em tempo real</li><li><Icon name="check"/> Relatórios e métricas do seu negócio</li><li><Icon name="check"/> Entrega, retirada e consumo no local</li></ul><div className={styles.restaurantActions}><Link href="/demo/painel">Conhecer o painel <span>→</span></Link><Link href="/cadastro">Solicitar acesso</Link></div></div>
      <div className={styles.dashboardMock}>
        <aside><Logo/>{[["▦","Resumo"],["▤","Pedidos"],["▣","Cardápio"],["♙","Clientes"],["◇","Cupons"],["▥","Relatórios"],["⚙","Configurações"]].map(([i,t],idx) => <Link href="/demo/painel" key={t} className={idx===0?styles.dashActive:""}><i>{i}</i>{t}</Link>)}</aside>
        <div className={styles.dashboardBody}><div className={styles.metricsRow}><article><small>Vendas hoje</small><b>R$ 1.250,00</b><em>↗ 25%</em></article><article><small>Pedidos hoje</small><b>32</b><em>↗ 10%</em></article><article><small>Ticket médio</small><b>R$ 39,06</b><em>↗ 12%</em></article></div><div className={styles.dashboardGrid}><article className={styles.chartCard}><header><b>Vendas nos últimos 7 dias</b><Link href="/demo/painel">Ver relatório</Link></header><svg viewBox="0 0 420 160" preserveAspectRatio="none"><path d="M0 128 C35 105 55 82 80 100 S120 135 150 92 S198 65 226 95 S270 125 303 82 S350 96 420 34" fill="none" stroke="#ff650b" strokeWidth="3"/>{[[0,128],[80,100],[150,92],[226,95],[303,82],[420,34]].map(([x,y]) => <circle key={x} cx={x} cy={y} r="4" fill="#ff650b"/>)}</svg><footer><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span><span>Dom</span></footer></article><article className={styles.ordersCard}><header><b>Pedidos recentes</b><Link href="/demo/painel">Ver todos</Link></header>{[["#1048","R$ 59,90","Novo"],["#1047","R$ 34,90","Preparando"],["#1046","R$ 89,90","Saiu para entrega"],["#1045","R$ 29,90","Entregue"]].map((r,i) => <div key={r[0]}><b>{r[0]}</b><span>{r[1]}</span><em className={styles[`status${i}`]}>{r[2]}</em></div>)}</article></div></div>
      </div>
    </section>

    <section className={styles.how} id="como-funciona"><div className={styles.sectionTitle}><span>DO CADASTRO AO PRIMEIRO PEDIDO</span><h2>Como funciona</h2><p>Em poucos passos, seu restaurante online e vendendo mais.</p></div><div className={styles.steps}>{steps.map(([icon,title,text],i) => <article key={title}><div className={styles.stepIcon}><Icon name={icon} size={34}/></div><span>{i+1}</span><h3>{title}</h3><p>{text}</p>{i<3?<i className={styles.arrow}>→</i>:null}</article>)}</div><div className={styles.howActions}><Link href="/cadastro">Solicitar acesso</Link><Link href="/loja/serra-burger">Experimentar como cliente</Link></div></section>

    <section className={styles.plans} id="planos"><div className={styles.sectionTitle}><span>ESCOLHA O SEU MOMENTO</span><h2>Planos que cabem no seu negócio</h2><p>Entre no piloto acompanhado e evolua quando sua operação pedir.</p></div><div className={styles.planGrid}>{plans.map(p => <article key={p.name} className={p.featured?styles.featuredPlan:""}>{p.featured?<div className={styles.planTop}><b>{p.name}</b><span>Mais escolhido</span></div>:<b className={styles.planName}>{p.name}</b>}<h3><sup>R$</sup>{p.price}<small>/mês</small></h3><p>{p.desc}</p><ul>{p.items.map(item => <li key={item}><span>✓</span>{item}</li>)}</ul><Link href={`/cadastro?plano=${p.slug}`} className={p.featured?styles.planPrimary:""}>Solicitar acesso</Link></article>)}</div><p className={styles.planNote}>Piloto por convite · sem comissão Rapidex por pedido. Pix, WhatsApp e IA dependem de integração ativa; tarifas de provedores são cobradas separadamente.</p></section>

    <section className={styles.why}><div className={styles.sectionTitle}><span>EXPERIÊNCIA PENSADA PARA CONVERTER</span><h2>Por que esse modelo vende melhor</h2></div><div><article><span>★★★★★</span><h3>Menos fricção</h3><p>O cliente abre o link e compra sem precisar instalar outro aplicativo.</p></article><article><span>★★★★★</span><h3>Mais relacionamento</h3><p>O restaurante mantém seu canal direto e pode trabalhar recompra com contexto.</p></article><article><span>★★★★★</span><h3>Mais controle</h3><p>Pedidos, cardápio, indicadores e operação ficam organizados em um só lugar.</p></article></div></section>

    <section className={styles.finalCta} id="contato"><div><Logo/><h2>Pronto para transformar seu restaurante?</h2><p>Crie seu cardápio online e comece a construir seu canal próprio.</p></div><div className={styles.finalActions}><Link href="/cadastro">Solicitar acesso <span>→</span></Link><Link href="/loja/serra-burger">Experimentar em tempo real</Link><Link href="/entrar">Acessar painel</Link></div></section>
    <footer className={styles.footer}><Logo/><span>© 2026 RapidexMenu. Todos os direitos reservados.</span><nav><a href="#como-funciona">Como funciona</a><a href="#planos">Planos</a><Link href="/loja/serra-burger">Experimentar</Link><Link href="/entrar">Painel</Link></nav></footer>
  </main>;
}

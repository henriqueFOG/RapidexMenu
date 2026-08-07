"use client";

import { useEffect, useState } from "react";
import styles from "./ApprovedLandingFixed.module.css";

type IconName = "store" | "clipboard" | "rocket" | "dashboard" | "shield" | "link" | "chart" | "clock" | "smile" | "report" | "check";

function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (name === "store") return <svg {...common}><path d="M4 10v9h16v-9"/><path d="M3 10l2-5h14l2 5"/><path d="M3 10c0 1.1.9 2 2 2s2-.9 2-2c0 1.1.9 2 2 2s2-.9 2-2c0 1.1.9 2 2 2s2-.9 2-2c0 1.1.9 2 2 2s2-.9 2-2c0 1.1.9 2 2 2s2-.9 2-2"/><path d="M9 19v-5h6v5"/></svg>;
  if (name === "clipboard") return <svg {...common}><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M8 9h8M8 13h8M8 17h5"/></svg>;
  if (name === "rocket") return <svg {...common}><path d="M14 5c3-2 5-2 5-2s0 2-2 5l-5 5-4-4 6-4Z"/><path d="M8 9 5 10l-2 3 5-1M12 13l-1 5-3 2 1-5"/><circle cx="14.5" cy="7.5" r="1.3"/></svg>;
  if (name === "dashboard") return <svg {...common}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 15l3-3 2 2 5-6M7 8h3"/></svg>;
  if (name === "shield") return <svg {...common}><path d="M12 3 5 6v5c0 4.5 3 7.5 7 10 4-2.5 7-5.5 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></svg>;
  if (name === "link") return <svg {...common}><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.2 1.2"/><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.2-1.2"/></svg>;
  if (name === "chart") return <svg {...common}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/><path d="m4 8 5-4 4 5 7-5"/></svg>;
  if (name === "clock") return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
  if (name === "smile") return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M8.5 10h.01M15.5 10h.01M8 14c1 2 2.5 3 4 3s3-1 4-3"/></svg>;
  if (name === "report") return <svg {...common}><path d="M5 3h14v18H5z"/><path d="M8 16v-3M12 16V9M16 16v-5"/></svg>;
  return <svg {...common}><path d="m5 12 4 4L19 6"/></svg>;
}

function Logo() {
  return <span className={styles.logo} aria-label="RapidexMenu">
    <svg viewBox="0 0 70 42" aria-hidden="true"><path d="M15 30h42M19 27c1-11 8-18 17-18s16 7 17 18H19ZM36 9V5M32 5h8M9 19h7M5 24h10M10 29h7"/><path d="M20 34h34"/></svg>
    <b>RAPIDEX<span>MENU</span></b>
  </span>;
}

const benefits: Array<[IconName,string,string]> = [
  ["chart","Mais oportunidades","para vender no canal próprio"],
  ["clipboard","Mais praticidade","para organizar a operação"],
  ["clock","Atendimento mais","rápido e eficiente"],
  ["smile","Clientes mais","bem atendidos"],
];

const plans = [
  { name: "Começo", price: "97", desc: "Para organizar o canal próprio e começar a vender direto.", items: ["Cardápio, link e QR Code","Gestor de pedidos","Pix e pagamento na entrega","Relatórios essenciais"] },
  { name: "Crescimento", price: "297", desc: "Para vender no automático e trazer clientes de volta.", featured: true, items: ["Tudo do plano Começo","Vendedor IA no WhatsApp","Memória de preferências","Recuperação e recompra","Guardião de margem"] },
  { name: "Escala", price: "597", desc: "Para operações com mais volume, equipe e unidades.", items: ["Tudo do Crescimento","Até 3 unidades","KDS e fila inteligente","Integrações e permissões","Suporte prioritário"] },
];

export default function ApprovedLandingV2() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const oldSite = document.querySelector<HTMLElement>("body > main.site");
    const directChildren = Array.from(document.body.children).filter((node): node is HTMLElement => node instanceof HTMLElement);
    const commercial = directChildren.find((node) => node !== oldSite && Boolean(node.querySelector('a[href="/calculadora"]')));
    const previousSiteDisplay = oldSite?.style.display ?? "";
    const previousCommercialDisplay = commercial?.style.display ?? "";
    if (oldSite) oldSite.style.display = "none";
    if (commercial) commercial.style.display = "none";
    return () => {
      if (oldSite) oldSite.style.display = previousSiteDisplay;
      if (commercial) commercial.style.display = previousCommercialDisplay;
    };
  }, []);

  const closeMenu = () => setMenuOpen(false);

  return <main className={styles.landing}>
    <section className={styles.hero} id="inicio">
      <header className={styles.header}>
        <a href="#inicio" onClick={closeMenu}><Logo /></a>
        <nav className={menuOpen ? styles.navOpen : ""}>
          <a href="#inicio" onClick={closeMenu} className={styles.active}>Início</a>
          <a href="#como-funciona" onClick={closeMenu}>Como Funciona</a>
          <a href="#para-restaurantes" onClick={closeMenu}>Para Restaurantes</a>
          <a href="#planos" onClick={closeMenu}>Planos</a>
          <a href="#contato" onClick={closeMenu}>Contato</a>
        </nav>
        <div className={styles.headerActions}>
          <a className={styles.panelButton} href="/admin">Acessar Painel</a>
          <button className={styles.mobileMenu} onClick={() => setMenuOpen(v => !v)} aria-label="Abrir menu">{menuOpen ? "✕" : "☰"}</button>
        </div>
      </header>

      <div className={styles.heroInner}>
        <div className={styles.heroCopy}>
          <h1>Cardápio Online.<br/>Pedidos. Entrega.<br/><span>Simples assim.</span></h1>
          <p>A plataforma completa para restaurantes que querem vender mais, organizar pedidos e encantar clientes.</p>
          <div className={styles.heroCtas}>
            <a className={styles.primaryCta} href="/cadastro">Quero meu cardápio online <span>→</span></a>
            <a className={styles.secondaryCta} href="#como-funciona"><span className={styles.play}>▶</span> Ver como funciona</a>
          </div>
          <div className={styles.heroFeatures}>
            <div><span><Icon name="dashboard"/></span><p><b>0% comissão</b><small>por pedido</small></p></div>
            <div><span><Icon name="shield"/></span><p><b>Cardápio 100%</b><small>personalizado</small></p></div>
            <div><span><Icon name="link"/></span><p><b>Pedidos via site,</b><small>WhatsApp e mais</small></p></div>
            <div><span><Icon name="report"/></span><p><b>Relatórios e controle</b><small>na palma da mão</small></p></div>
          </div>
        </div>

        <div className={styles.heroVisual} aria-label="Cardápio RapidexMenu no celular ao lado de um hambúrguer">
          <img className={styles.burgerPhoto} src="https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1100&q=92" alt="Hambúrguer artesanal" />
          <div className={styles.phoneMock}>
            <div className={styles.phoneBar}><span>3:03</span><i>● ● ●</i></div>
            <div className={styles.phoneRestaurant}><div><b>Sabor &amp; Arte</b><small>Restaurante</small><em>Aberto agora até 23:00</em></div><span>🍕</span></div>
            <div className={styles.phoneDelivery}>● Entrega · 30–50 min · R$ 5,00</div>
            <h3>Destaques</h3>
            {[
              ["🍔","X-Burguer Artesanal","Pão brioche, 180g de carne, queijo cheddar, alface, tomate e molho especial.","R$ 29,90"],
              ["🍕","Pizza Calabresa","Massa artesanal, molho de tomate, mussarela e calabresa.","R$ 34,90"],
              ["🥤","Combo Família","2 pizzas grandes + refrigerante 2L grátis","R$ 89,90"],
            ].map(item => <article key={item[1]}><span>{item[0]}</span><div><b>{item[1]}</b><small>{item[2]}</small><strong>{item[3]}</strong></div><button aria-label={`Adicionar ${item[1]}`}>+</button></article>)}
            <footer><span>⌂<small>Início</small></span><span>▱<small>Cardápio</small></span><span>▤<small>Meu pedido</small></span><span>♙<small>Conta</small></span></footer>
          </div>
        </div>
      </div>
    </section>

    <section className={styles.proofBand} aria-label="Benefícios do RapidexMenu">
      <h2>Seu canal próprio pronto para vender mais com o RapidexMenu</h2>
      <div>{benefits.map(([icon,title,text]) => <article key={title}><span><Icon name={icon}/></span><p><b>{title}</b><small>{text}</small></p></article>)}</div>
    </section>

    <section className={styles.restaurantSection} id="para-restaurantes">
      <div className={styles.restaurantCopy}>
        <h2>Para restaurantes que querem <span>crescer de verdade</span></h2>
        <p>Ferramentas completas para facilitar sua rotina, encantar seus clientes e aumentar suas vendas.</p>
        <ul>
          <li><Icon name="check"/> Cardápio online personalizado</li>
          <li><Icon name="check"/> Pedidos via site, WhatsApp e QR Code</li>
          <li><Icon name="check"/> Gestão de pedidos em tempo real</li>
          <li><Icon name="check"/> Relatórios e métricas do seu negócio</li>
          <li><Icon name="check"/> Cupons, promoções e muito mais</li>
        </ul>
        <a href="/admin">Conhecer o painel <span>→</span></a>
      </div>

      <div className={styles.dashboardMock} aria-label="Demonstração do painel RapidexMenu">
        <aside>
          <Logo />
          {[["▦","Resumo"],["▤","Pedidos"],["▣","Cardápio"],["♙","Clientes"],["◇","Cupons"],["▥","Relatórios"],["⚙","Configurações"]].map(([icon,title],idx) => <span key={title} className={idx===0?styles.dashActive:""}><i>{icon}</i>{title}</span>)}
        </aside>
        <div className={styles.dashboardBody}>
          <div className={styles.metricsRow}>
            <article><small>Vendas hoje</small><b>R$ 1.250,00</b><em>↗ 25%</em></article>
            <article><small>Pedidos hoje</small><b>32</b><em>↗ 10%</em></article>
            <article><small>Ticket médio</small><b>R$ 39,06</b><em>↗ 12%</em></article>
          </div>
          <div className={styles.dashboardGrid}>
            <article className={styles.chartCard}>
              <header><b>Vendas nos últimos 7 dias</b><span>Ver relatório</span></header>
              <svg viewBox="0 0 420 160" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="approved-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff650b" stopOpacity=".23"/><stop offset="1" stopColor="#ff650b" stopOpacity="0"/></linearGradient></defs><path d="M0 128 C35 105 55 82 80 100 S120 135 150 92 S198 65 226 95 S270 125 303 82 S350 96 420 34 L420 160 L0 160Z" fill="url(#approved-area)"/><path d="M0 128 C35 105 55 82 80 100 S120 135 150 92 S198 65 226 95 S270 125 303 82 S350 96 420 34" fill="none" stroke="#ff650b" strokeWidth="3"/>{[[0,128],[80,100],[150,92],[226,95],[303,82],[420,34]].map(([x,y]) => <circle key={x} cx={x} cy={y} r="4" fill="#ff650b"/>)}</svg>
              <footer><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span><span>Dom</span></footer>
            </article>
            <article className={styles.ordersCard}>
              <header><b>Pedidos recentes</b><span>Ver todos</span></header>
              {[["#1048","R$ 59,90","Novo"],["#1047","R$ 34,90","Preparando"],["#1046","R$ 89,90","Saiu para entrega"],["#1045","R$ 29,90","Entregue"]].map((row,i) => <div key={row[0]}><b>{row[0]}</b><span>{row[1]}</span><em className={styles[`status${i}`]}>{row[2]}</em></div>)}
            </article>
          </div>
        </div>
      </div>
    </section>

    <section className={styles.how} id="como-funciona">
      <div className={styles.sectionTitle}><h2>Como funciona</h2><p>Em poucos passos, seu restaurante online e vendendo mais.</p></div>
      <div className={styles.steps}>
        {[
          ["store" as IconName,"Cadastre seu restaurante","É rápido e fácil"],
          ["clipboard" as IconName,"Monte seu cardápio","Adicione produtos, fotos e preços"],
          ["rocket" as IconName,"Publique e compartilhe","Seu cardápio online pronto para receber pedidos"],
          ["dashboard" as IconName,"Receba pedidos e venda mais","Gerencie tudo em um só lugar"],
        ].map(([icon,title,text],i) => <article key={title}><div className={styles.stepIcon}><Icon name={icon} size={34}/></div><span>{i+1}</span><h3>{title}</h3><p>{text}</p>{i<3&&<i className={styles.arrow}>→</i>}</article>)}
      </div>
    </section>

    <section className={styles.plans} id="planos">
      <div className={styles.sectionTitle}><h2>Planos que cabem no seu negócio</h2><p>Comece agora e evolua quando sua operação pedir.</p></div>
      <div className={styles.planGrid}>
        {plans.map(plan => <article key={plan.name} className={plan.featured?styles.featuredPlan:""}>
          {plan.featured ? <div className={styles.planTop}><b>{plan.name}</b><span>Mais escolhido</span></div> : <b className={styles.planName}>{plan.name}</b>}
          <h3><sup>R$</sup>{plan.price}<small>/mês</small></h3>
          <p>{plan.desc}</p>
          <ul>{plan.items.map(item => <li key={item}><span>✓</span>{item}</li>)}</ul>
          <a href="/cadastro" className={plan.featured?styles.planPrimary:""}>{plan.featured?"Quero crescer":"Começar agora"}</a>
        </article>)}
      </div>
      <p className={styles.planNote}>Sem comissão sobre o pedido. Tarifas do meio de pagamento, quando houver, são cobradas pelo provedor escolhido.</p>
    </section>

    <section className={styles.why}>
      <h2>Por que esse modelo vende melhor</h2>
      <div>
        <article><span>★★★★★</span><h3>Menos fricção</h3><p>O cliente abre o link e compra sem precisar instalar outro aplicativo.</p></article>
        <article><span>★★★★★</span><h3>Mais relacionamento</h3><p>O restaurante mantém seu canal direto e pode trabalhar recompra com contexto.</p></article>
        <article><span>★★★★★</span><h3>Mais controle</h3><p>Pedidos, cardápio, indicadores e operação ficam organizados em um só lugar.</p></article>
      </div>
    </section>

    <section className={styles.finalCta} id="contato">
      <div><Logo /><h2>Pronto para transformar seu restaurante?</h2><p>Crie seu cardápio online e comece a construir seu canal próprio.</p></div>
      <a href="/cadastro">Começar agora <span>→</span></a>
    </section>

    <footer className={styles.footer}>
      <Logo />
      <span>© 2026 RapidexMenu. Todos os direitos reservados.</span>
      <nav><a href="#como-funciona">Como funciona</a><a href="#planos">Planos</a><a href="/admin">Painel</a></nav>
    </footer>
  </main>;
}

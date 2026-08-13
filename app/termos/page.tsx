import { RAPIDEX_TERMS_VERSION_LABEL } from "@/lib/legal";
import Link from "next/link";
import type { ReactNode } from "react";
import styles from "../commercial.module.css";

export const metadata = { title: "Termos de Uso | RapidexMenu" };

export default function TermsPage() {
  return <main className={styles.shell}><article className={styles.card}>
    <Link className={styles.brand} href="/"><span>⚡</span><b>Rapidex<i>Menu</i></b></Link>
    <small className={styles.kicker}>TERMOS DE USO · VERSÃO {RAPIDEX_TERMS_VERSION_LABEL}</small>
    <h1 className={styles.title}>Termos de Uso do RapidexMenu</h1>
    <p className={styles.intro}>Estes termos regulam o uso da plataforma RapidexMenu por restaurantes, estabelecimentos e seus usuários autorizados.</p>
    <Legal title="1. Serviço">O RapidexMenu oferece cardápio digital, gestão de pedidos, relacionamento com clientes e recursos de automação. Funcionalidades que dependem de terceiros, como WhatsApp, inteligência artificial e meios de pagamento, podem exigir credenciais, aprovação ou tarifas desses fornecedores.</Legal>
    <Legal title="2. Conta e responsabilidade">O estabelecimento deve fornecer informações verdadeiras, manter suas credenciais em sigilo e limitar o acesso do painel às pessoas autorizadas. O titular da conta responde pelos produtos, preços, disponibilidade, informações alimentares, atendimento, entrega, tributos e obrigações da operação do restaurante.</Legal>
    <Legal title="3. Período de teste e planos">Novas contas podem receber 14 dias de teste conforme a oferta exibida no cadastro. A continuidade após o teste depende do plano contratado. O RapidexMenu não cobra comissão própria sobre pedidos do canal direto, mas provedores de pagamento, mensageria ou outros serviços podem cobrar suas próprias tarifas.</Legal>
    <Legal title="4. Pedidos e pagamentos">A plataforma registra e organiza pedidos, mas a relação de consumo do pedido de alimentos ocorre entre o estabelecimento e seu cliente. O restaurante deve conferir pedidos, pagamentos, cancelamentos, reembolsos e entregas. Integrações externas estão sujeitas à disponibilidade e às regras do respectivo fornecedor.</Legal>
    <Legal title="5. Uso aceitável">É proibido usar a plataforma para fraude, spam, conteúdo ilegal, violação de direitos, tentativa de acesso não autorizado, exploração de vulnerabilidades ou envio de mensagens sem base legal/consentimento quando exigido.</Legal>
    <Legal title="6. Dados e LGPD">O tratamento de dados segue a Política de Privacidade. Em geral, o restaurante é responsável pelas decisões sobre os dados de seus próprios clientes, e o RapidexMenu trata esses dados para prestar o serviço, observadas as funções e responsabilidades aplicáveis em cada operação.</Legal>
    <Legal title="7. Disponibilidade e mudanças">Buscamos manter o serviço disponível e seguro, mas não garantimos funcionamento ininterrupto de internet, infraestrutura ou integrações de terceiros. Mudanças materiais nestes termos serão comunicadas de forma adequada e uma nova aceitação poderá ser solicitada.</Legal>
    <Legal title="8. Cancelamento">O estabelecimento pode solicitar o encerramento da conta. Obrigações já vencidas, registros que precisem ser preservados por obrigação legal e responsabilidades por operações anteriores podem permanecer após o cancelamento.</Legal>
    <Legal title="9. Contato e legislação">Dúvidas e solicitações devem ser enviadas pelo canal de suporte disponibilizado na plataforma. Estes termos são regidos pelas leis brasileiras, inclusive normas de proteção do consumidor e de dados quando aplicáveis.</Legal>
    <p className={styles.note}>Ao criar uma conta e marcar o aceite, você confirma que leu e concorda com estes Termos de Uso.</p>
  </article></main>;
}

function Legal({ title, children }: { title: string; children: ReactNode }) {
  return <section className={styles.panel}><h2>{title}</h2><p style={{ margin: 0, lineHeight: 1.65 }}>{children}</p></section>;
}

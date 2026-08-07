import Link from "next/link";
import type { ReactNode } from "react";
import styles from "../commercial.module.css";

export const metadata = { title: "Política de Privacidade | RapidexMenu" };

export default function PrivacyPage() {
  return <main className={styles.shell}><article className={styles.card}>
    <Link className={styles.brand} href="/"><span>⚡</span><b>Rapidex<i>Menu</i></b></Link>
    <small className={styles.kicker}>PRIVACIDADE E LGPD · VERSÃO 07/08/2026</small>
    <h1 className={styles.title}>Política de Privacidade</h1>
    <p className={styles.intro}>Esta política explica como o RapidexMenu trata dados para criar contas, operar lojas, processar pedidos, manter segurança e disponibilizar automações aos estabelecimentos.</p>
    <Legal title="1. Dados tratados">Podemos tratar dados cadastrais do estabelecimento e de seus usuários, como nome, e-mail, telefone, função e dados da loja; dados operacionais de pedidos; dados de clientes informados durante pedidos, como nome, contato e endereço; registros técnicos de segurança, consentimentos e uso da plataforma.</Legal>
    <Legal title="2. Finalidades">Os dados são usados para autenticar usuários, criar e administrar lojas, receber e acompanhar pedidos, prestar suporte, prevenir fraude e abuso, cumprir obrigações legais, medir o funcionamento do serviço e executar recursos contratados de automação, mensageria e pagamento.</Legal>
    <Legal title="3. Bases legais">O tratamento pode ocorrer para execução de contrato e procedimentos preliminares, cumprimento de obrigação legal ou regulatória, exercício regular de direitos, legítimo interesse quando aplicável e consentimento quando essa for a base adequada, especialmente para determinadas comunicações promocionais.</Legal>
    <Legal title="4. Restaurante e clientes finais">O estabelecimento decide como utiliza os dados de seus clientes no contexto da própria operação e deve informar seus consumidores e respeitar a legislação aplicável. O RapidexMenu trata os dados necessários à prestação da plataforma conforme as instruções e configurações legítimas do estabelecimento e as obrigações próprias de segurança e conformidade.</Legal>
    <Legal title="5. Compartilhamento">Dados podem ser processados por provedores de infraestrutura, banco de dados, mensageria, inteligência artificial, pagamento e outros fornecedores necessários à funcionalidade contratada. Compartilhamos apenas o necessário para a finalidade correspondente e não vendemos dados pessoais.</Legal>
    <Legal title="6. Segurança">Aplicamos controles como autenticação, segregação lógica por restaurante, sessões protegidas, limitação de tentativas, registros de auditoria e credenciais mantidas no servidor. Nenhum sistema é imune a incidentes; eventos relevantes serão tratados conforme as obrigações aplicáveis.</Legal>
    <Legal title="7. Retenção e exclusão">Os dados são mantidos pelo período necessário à prestação do serviço, segurança, prevenção de fraude, exercício de direitos e cumprimento de obrigações. Solicitações de encerramento ou exclusão serão avaliadas considerando hipóteses legais de retenção.</Legal>
    <Legal title="8. Direitos do titular">Titulares podem solicitar, quando aplicável, confirmação de tratamento, acesso, correção, anonimização, bloqueio, eliminação, portabilidade, informações sobre compartilhamento e revisão ou revogação de consentimento. As solicitações podem exigir validação de identidade.</Legal>
    <Legal title="9. Cookies e sessão">Utilizamos cookies estritamente necessários para manter sessões autenticadas e proteger o acesso ao painel. Recursos adicionais de medição, caso sejam ativados, deverão respeitar as configurações e bases legais aplicáveis.</Legal>
    <Legal title="10. Contato e atualização">Solicitações de privacidade podem ser feitas pelo canal de suporte disponibilizado na plataforma. Esta política pode ser atualizada para refletir mudanças legais, técnicas ou de produto; alterações relevantes serão comunicadas de maneira adequada.</Legal>
    <p className={styles.note}>O cadastro registra a data do aceite desta política para fins de rastreabilidade.</p>
  </article></main>;
}

function Legal({ title, children }: { title: string; children: ReactNode }) {
  return <section className={styles.panel}><h2>{title}</h2><p style={{ margin: 0, lineHeight: 1.65 }}>{children}</p></section>;
}

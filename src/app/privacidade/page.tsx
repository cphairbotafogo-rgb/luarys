import { createClient } from '@supabase/supabase-js';
import { PaginaLegal, SL } from '@/components/PaginaLegal';

export const revalidate = 3600;

export const metadata = {
  title: 'Política de Privacidade — Luarys',
  description: 'Como o Luarys coleta, usa e protege seus dados pessoais.',
};

async function getDoc() {
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
    );
    const { data } = await sb
      .from('plataforma_documentos')
      .select('titulo, conteudo, atualizado_em')
      .eq('tipo', 'privacidade')
      .eq('ativo', true)
      .maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
}

export default async function PoliticaPrivacidade() {
  const doc = await getDoc();

  if (doc?.conteudo) {
    const atualizado = new Date(doc.atualizado_em).toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
    return (
      <PaginaLegal titulo={doc.titulo || 'Política de Privacidade'} atualizadoEm={atualizado}>
        <div className="legal-content" dangerouslySetInnerHTML={{ __html: doc.conteudo }} />
      </PaginaLegal>
    );
  }

  return (
    <PaginaLegal titulo="Política de Privacidade" atualizadoEm="22 de junho de 2026">

      <p style={SL.p}>
        Esta Política de Privacidade descreve como a <strong>[RAZÃO SOCIAL DA EMPRESA]</strong>, inscrita sob o CNPJ <strong>[CNPJ]</strong>, com sede em <strong>[ENDEREÇO COMPLETO]</strong> ("Luarys", "nós"), coleta, usa, armazena e compartilha dados pessoais no contexto da plataforma Luarys, em conformidade com a Lei Geral de Proteção de Dados Pessoais (LGPD — Lei 13.709/2018).
      </p>
      <p style={SL.p}>
        Ao usar a plataforma, você confirma que leu e compreendeu esta Política. Se não concordar com algum ponto, não utilize o serviço e entre em contato pelo e-mail indicado ao final.
      </p>

      {/* 1 */}
      <h2 style={SL.h2}>1. Quem é o controlador dos dados</h2>
      <p style={SL.p}>
        O Luarys atua como <strong>controlador</strong> dos dados dos lojistas (donos e funcionários de salões) e dos clientes finais que usam o portal de agendamento. Para os dados dos clientes finais dos salões, o salão é o controlador e o Luarys atua como <strong>operador</strong>, processando dados conforme as instruções do salão.
      </p>

      {/* 2 */}
      <h2 style={SL.h2}>2. Dados que coletamos</h2>
      <div style={SL.box}>
        <p style={{ ...SL.p, margin: '0 0 8px', fontWeight: 600 }}>Lojistas (donos e funcionários de salão)</p>
        <ul style={SL.ul}>
          <li>Nome completo, e-mail, telefone e senha (hash)</li>
          <li>CNPJ, razão social, inscrição municipal/estadual, endereço do estabelecimento</li>
          <li>Dados bancários para fins de pagamento de assinatura</li>
          <li>Logs de acesso (IP, horário, ação realizada) para segurança e auditoria</li>
        </ul>
      </div>
      <div style={SL.box}>
        <p style={{ ...SL.p, margin: '0 0 8px', fontWeight: 600 }}>Clientes finais dos salões (portal de agendamento)</p>
        <ul style={SL.ul}>
          <li>Nome, e-mail, telefone e CPF</li>
          <li>Histórico de agendamentos e serviços realizados</li>
          <li>Dados de saúde coletados via ficha de anamnese — <strong>somente mediante consentimento explícito e separado</strong></li>
          <li>Endereço (informado no cadastro do portal)</li>
        </ul>
      </div>
      <div style={SL.box}>
        <p style={{ ...SL.p, margin: '0 0 8px', fontWeight: 600 }}>Dados coletados automaticamente</p>
        <ul style={SL.ul}>
          <li>Endereço IP e identificador de sessão</li>
          <li>Tipo de dispositivo e navegador</li>
          <li>Cookies funcionais (detalhados na seção 8)</li>
        </ul>
      </div>

      {/* 3 */}
      <h2 style={SL.h2}>3. Finalidade e base legal</h2>
      <ul style={SL.ul}>
        <li><span style={SL.tag}>Art. 7, V</span> <strong>Execução de contrato</strong> — criar e manter a conta, processar agendamentos, emitir notas fiscais, processar pagamentos.</li>
        <li><span style={SL.tag}>Art. 7, II</span> <strong>Obrigação legal</strong> — emissão de NFS-e e NFC-e, retenção de registros fiscais por 5 anos (Lei 9.430/1996).</li>
        <li><span style={SL.tag}>Art. 11, I</span> <strong>Consentimento explícito</strong> — coleta e tratamento de dados de saúde nas fichas de anamnese. O consentimento pode ser revogado a qualquer momento.</li>
        <li><span style={SL.tag}>Art. 7, IX</span> <strong>Legítimo interesse</strong> — prevenção a fraudes, segurança da plataforma, melhoria contínua do serviço, envio de comunicações operacionais.</li>
        <li><span style={SL.tag}>Art. 7, IX / I</span> <strong>Marketing e comunicações promocionais</strong> — envio de novidades, campanhas, atualizações e conteúdos relacionados à plataforma, com base em legítimo interesse ou consentimento, conforme o canal utilizado. O titular pode cancelar a qualquer momento via link de descadastro.</li>
      </ul>
      <p style={SL.p}>Não usamos dados pessoais para finalidades incompatíveis com as listadas acima sem novo consentimento.</p>

      {/* 4 */}
      <h2 style={SL.h2}>4. Compartilhamento com terceiros</h2>
      <p style={SL.p}>Compartilhamos dados apenas na extensão necessária para operar o serviço. Não vendemos nem alugamos dados pessoais. Os subprocessadores atuais são:</p>
      <ul style={SL.ul}>
        <li><strong>Supabase Inc.</strong> (EUA) — banco de dados, autenticação e armazenamento de arquivos. Dados transferidos com base em Cláusulas Contratuais Padrão (SCCs).</li>
        <li><strong>Mercado Pago S.A.</strong> (Brasil) — processamento de pagamentos e geração de PIX/link de pagamento.</li>
        <li><strong>InfinitePay / CloudWalk Inc.</strong> (Brasil) — processamento de pagamentos via maquininha.</li>
        <li><strong>Tecnospeed S.A. (Focus NFe)</strong> (Brasil) — emissão de NFS-e e NFC-e junto à SEFAZ e prefeituras.</li>
        <li><strong>Vercel Inc.</strong> (EUA) — hospedagem da aplicação web. Dados de requisição (IP, headers) passam pelos servidores da Vercel. SCCs aplicáveis.</li>
      </ul>
      <p style={SL.p}>Podemos compartilhar dados com autoridades públicas quando exigido por lei ou ordem judicial.</p>
      <p style={SL.p}>Novos subprocessadores poderão ser adicionados mediante atualização desta Política com aviso prévio de 30 dias, exceto em casos de urgência técnica ou legal devidamente justificados.</p>

      {/* 5 */}
      <h2 style={SL.h2}>5. Transferências internacionais</h2>
      <p style={SL.p}>
        Alguns de nossos subprocessadores estão sediados nos EUA (Supabase, Vercel). Essas transferências são realizadas com salvaguardas adequadas — Cláusulas Contratuais Padrão aprovadas pela autoridade supervisora — em conformidade com o art. 33 da LGPD.
      </p>

      {/* 6 */}
      <h2 style={SL.h2}>6. Retenção de dados</h2>
      <ul style={SL.ul}>
        <li><strong>Dados fiscais</strong> (notas emitidas, transações): mínimo de 5 anos por obrigação legal.</li>
        <li><strong>Dados de saúde</strong> (fichas de anamnese): pelo prazo consentido ou enquanto a conta estiver ativa. Excluídos em prazo razoável e tecnicamente viável após revogação do consentimento ou encerramento da conta, respeitadas eventuais obrigações legais de retenção.</li>
        <li><strong>Conta ativa</strong>: durante a vigência do contrato e por 90 dias após o encerramento para fins de auditoria interna. Os dados pessoais identificadores são anonimizados; registros financeiros e fiscais são preservados sem vínculo nominal.</li>
        <li><strong>Contas inativas</strong>: contas sem acesso por período superior a 24 meses poderão ser encerradas mediante aviso prévio de 30 dias por e-mail.</li>
        <li><strong>Logs de segurança</strong>: 12 meses.</li>
      </ul>

      {/* 7 */}
      <h2 style={SL.h2}>7. Seus direitos (LGPD, art. 18)</h2>
      <p style={SL.p}>Você tem os seguintes direitos em relação aos seus dados pessoais:</p>
      <ul style={SL.ul}>
        <li><strong>Acesso</strong> — saber quais dados temos sobre você.</li>
        <li><strong>Correção</strong> — corrigir dados incompletos, inexatos ou desatualizados.</li>
        <li><strong>Anonimização, bloqueio ou eliminação</strong> — de dados desnecessários ou tratados em desconformidade.</li>
        <li><strong>Portabilidade</strong> — receber seus dados em formato estruturado.</li>
        <li><strong>Eliminação</strong> — excluir dados tratados com base em consentimento, ressalvadas obrigações legais.</li>
        <li><strong>Revogação do consentimento</strong> — retirar o consentimento a qualquer momento, sem prejuízo do tratamento realizado anteriormente.</li>
        <li><strong>Oposição</strong> — opor-se a tratamento baseado em legítimo interesse.</li>
      </ul>
      <p style={SL.p}>Para exercer qualquer direito, envie solicitação para <strong>privacidade@luarys.com.br</strong>. Responderemos em até 15 dias úteis. A portabilidade de dados e a exportação do histórico também estão disponíveis diretamente no painel da plataforma, sem necessidade de solicitação formal.</p>

      {/* 8 */}
      <h2 style={SL.h2}>8. Cookies e rastreamento</h2>
      <p style={SL.p}>Utilizamos apenas cookies estritamente necessários ao funcionamento da plataforma:</p>
      <ul style={SL.ul}>
        <li><strong>Sessão de autenticação</strong> — mantém o usuário logado de forma segura (httpOnly, SameSite=Lax).</li>
        <li><strong>Preferências de interface</strong> — armazena configurações visuais escolhidas pelo usuário.</li>
      </ul>
      <p style={SL.p}>Não utilizamos cookies de rastreamento publicitário, pixels de terceiros ou ferramentas de analytics comportamentais sem consentimento prévio. O aceite ao banner de cookies registra a data e hora da confirmação.</p>

      {/* 9 */}
      <h2 style={SL.h2}>9. Segurança</h2>
      <p style={SL.p}>
        Adotamos medidas técnicas e organizacionais compatíveis com o estado da arte para proteger os dados: criptografia em trânsito (TLS 1.2+) e em repouso, controle de acesso por função (RBAC), Row-Level Security no banco de dados, autenticação multifator disponível e monitoramento contínuo de acessos suspeitos. Mantemos rotinas automatizadas de backup para fins de continuidade operacional e recuperação de incidentes.
      </p>
      <p style={SL.p}>
        Em caso de incidente de segurança envolvendo dados de lojistas (nos quais o Luarys é Controlador), notificaremos a ANPD e os titulares afetados em até 2 dias úteis após ciência do ocorrido, conforme resolução vigente da ANPD. Para incidentes envolvendo dados de clientes finais dos salões (nos quais o Luarys é Operador), notificaremos o salão Controlador no mesmo prazo, ficando sob responsabilidade do salão a comunicação a seus clientes e à ANPD.
      </p>

      {/* 10 */}
      <h2 style={SL.h2}>10. Menores de idade</h2>
      <p style={SL.p}>
        O portal de agendamento pode ser utilizado por pessoas a partir de 13 anos, desde que com consentimento do responsável legal para titulares entre 13 e 17 anos. Não coletamos intencionalmente dados de crianças menores de 12 anos sem consentimento específico e em destaque do responsável legal, conforme art. 14 da LGPD. Se identificarmos coleta indevida de dados de crianças, excluiremos os dados em prazo razoável. A funcionalidade de ficha de anamnese (dados sensíveis de saúde) é restrita a maiores de 18 anos ou a menores mediante consentimento do responsável.
      </p>

      {/* 11 */}
      <h2 style={SL.h2}>11. Alterações nesta política</h2>
      <p style={SL.p}>
        Podemos atualizar esta Política periodicamente. Quando as alterações forem relevantes, notificaremos os usuários por e-mail ou aviso destacado na plataforma com antecedência mínima de 15 dias. O uso continuado após a data de vigência das novas condições implica aceitação.
      </p>

      {/* 12 */}
      <h2 style={SL.h2}>12. Contato e Encarregado de Dados (DPO)</h2>
      <div style={SL.box}>
        <p style={{ ...SL.p, margin: '0 0 4px' }}><strong>Encarregado de Proteção de Dados:</strong> [NOME DO DPO]</p>
        <p style={{ ...SL.p, margin: '0 0 4px' }}><strong>E-mail:</strong> privacidade@luarys.com.br</p>
        <p style={{ ...SL.p, margin: 0 }}><strong>Endereço:</strong> [ENDEREÇO COMPLETO]</p>
      </div>
      <p style={SL.p}>
        Você também pode apresentar reclamação à Autoridade Nacional de Proteção de Dados (ANPD) pelo site <strong>gov.br/anpd</strong>.
      </p>

    </PaginaLegal>
  );
}

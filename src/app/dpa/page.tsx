import sanitizeHtml from 'sanitize-html';
import { createClient } from '@supabase/supabase-js';
import { PaginaLegal, SL } from '@/components/PaginaLegal';

export const revalidate = 3600;

export const metadata = {
  title: 'Contrato de Tratamento de Dados — Luarys',
  description: 'Contrato de Tratamento de Dados Pessoais (DPA) entre a Luarys e os salões clientes.',
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
      .eq('tipo', 'dpa')
      .eq('ativo', true)
      .maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
}

export default async function ContratoTratamentoDados() {
  const doc = await getDoc();

  if (doc?.conteudo) {
    const atualizado = new Date(doc.atualizado_em).toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
    return (
      <PaginaLegal titulo={doc.titulo || 'Contrato de Tratamento de Dados (CTD/DPA)'} atualizadoEm={atualizado}>
        <div className="legal-content" dangerouslySetInnerHTML={{ __html: sanitizeHtml(doc.conteudo, { allowedTags: sanitizeHtml.defaults.allowedTags.concat(['h1', 'h2', 'h3', 'img']), allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes, '*': ['style', 'class'] } }) }} />
      </PaginaLegal>
    );
  }

  return (
    <PaginaLegal titulo="Contrato de Tratamento de Dados (CTD/DPA)" atualizadoEm="22 de junho de 2026">

      <p style={SL.p}>
        Este Contrato de Tratamento de Dados ("CTD" ou "DPA") é celebrado entre a <strong>[RAZÃO SOCIAL DA EMPRESA]</strong>, CNPJ <strong>[CNPJ]</strong> ("Luarys" ou "Operador") e o salão ou estabelecimento que utiliza a plataforma Luarys ("Controlador"), nos termos da Lei Geral de Proteção de Dados Pessoais (LGPD — Lei 13.709/2018).
      </p>
      <p style={SL.p}>
        Este CTD é incorporado e forma parte integrante dos <a href="/termos" style={{ color: '#2C3643', fontWeight: 600 }}>Termos de Uso</a>. Ao aceitar os Termos de Uso, o Controlador também aceita as condições deste CTD.
      </p>

      {/* 1 */}
      <h2 style={SL.h2}>1. Definições</h2>
      <ul style={SL.ul}>
        <li><strong>Controlador:</strong> o salão ou estabelecimento que decide como e por que os dados pessoais dos seus clientes são tratados.</li>
        <li><strong>Operador:</strong> a Luarys, que trata dados pessoais em nome e conforme as instruções do Controlador.</li>
        <li><strong>Titular:</strong> os clientes finais do salão cujos dados são tratados na plataforma.</li>
        <li><strong>Dados Pessoais:</strong> toda informação relacionada a pessoa natural identificada ou identificável (LGPD, art. 5º, I).</li>
        <li><strong>Dados Pessoais Sensíveis:</strong> dados de saúde coletados via ficha de anamnese (LGPD, art. 5º, II).</li>
      </ul>

      {/* 2 */}
      <h2 style={SL.h2}>2. Objeto e natureza do tratamento</h2>
      <p style={SL.p}>
        A Luarys tratará dados pessoais dos clientes do Controlador exclusivamente para viabilizar as funcionalidades contratadas: gestão de agendamentos, histórico de serviços, ficha técnica/anamnese, emissão de notas fiscais, processamento de pagamentos e comunicações operacionais com o titular.
      </p>
      <p style={SL.p}>
        O Operador não usará os dados dos titulares do Controlador para nenhuma finalidade própria, incluindo fins comerciais, de análise de mercado, ou compartilhamento com terceiros não listados neste CTD.
      </p>

      {/* 3 */}
      <h2 style={SL.h2}>3. Tipos de dados e categorias de titulares</h2>
      <div style={SL.box}>
        <p style={{ ...SL.p, fontWeight: 600, margin: '0 0 8px' }}>Dados tratados pelo Operador em nome do Controlador:</p>
        <ul style={{ ...SL.ul, margin: 0 }}>
          <li>Dados de identificação: nome completo, CPF, e-mail, telefone</li>
          <li>Dados de serviço: histórico de agendamentos, serviços realizados, profissional responsável</li>
          <li>Dados sensíveis de saúde: informações de anamnese (alergias, tipo de pele/cabelo, medicamentos) — somente quando o Controlador habilitar este módulo e o titular consentir</li>
          <li>Dados financeiros: pagamentos realizados, histórico de compras na vitrine</li>
        </ul>
      </div>
      <p style={SL.p}>Titulares: clientes pessoas físicas dos salões e estabelecimentos que usam a plataforma Luarys.</p>

      {/* 4 */}
      <h2 style={SL.h2}>4. Vigência</h2>
      <p style={SL.p}>
        Este CTD vigora pelo mesmo período do contrato de serviço entre as partes. O encerramento do contrato implica o encerramento do tratamento, observados os prazos de retenção obrigatórios previstos na Cláusula 9.
      </p>

      {/* 5 */}
      <h2 style={SL.h2}>5. Obrigações do Operador (Luarys)</h2>
      <ul style={SL.ul}>
        <li>Tratar os dados pessoais apenas conforme as instruções documentadas do Controlador e as finalidades previstas neste CTD.</li>
        <li>Garantir que os colaboradores e sistemas com acesso aos dados estão sujeitos a obrigações de confidencialidade.</li>
        <li>Implementar medidas técnicas e organizacionais adequadas para proteger os dados (criptografia em trânsito e em repouso, controle de acesso, RLS no banco de dados).</li>
        <li>Notificar o Controlador em até 2 dias úteis após tomar conhecimento de incidente de segurança que afete os dados do Controlador, conforme resolução vigente da ANPD.</li>
        <li>Auxiliar o Controlador no atendimento de requisições de direitos dos titulares (acesso, correção, exclusão, portabilidade), na medida do tecnicamente viável.</li>
        <li>Fornecer ao Controlador as informações necessárias para demonstrar cumprimento da LGPD, mediante solicitação justificada.</li>
        <li>Encerrar o tratamento e excluir ou devolver os dados ao término do contrato, salvo obrigação legal de retenção.</li>
      </ul>

      {/* 6 */}
      <h2 style={SL.h2}>6. Obrigações do Controlador (Salão)</h2>
      <ul style={SL.ul}>
        <li>Garantir que possui base legal adequada para tratar os dados pessoais dos seus clientes e para contratar o Operador.</li>
        <li>Obter consentimento explícito e informado dos titulares antes de coletar dados sensíveis de saúde via ficha de anamnese.</li>
        <li>Informar os titulares sobre o uso da plataforma Luarys como ferramenta de gestão, mediante aviso de privacidade próprio ou referência à Política de Privacidade da Luarys.</li>
        <li>Atender com presteza as requisições de direitos dos seus clientes, usando as ferramentas disponíveis na plataforma.</li>
        <li>Não fornecer à plataforma dados pessoais além do necessário para as finalidades contratadas.</li>
        <li>Notificar o Operador imediatamente se tomar conhecimento de uso indevido ou violação de dados.</li>
      </ul>

      {/* 7 */}
      <h2 style={SL.h2}>7. Suboperadores aprovados</h2>
      <p style={SL.p}>
        O Controlador autoriza o Operador a utilizar os seguintes suboperadores para prestação dos serviços contratados. O Operador garante que esses suboperadores oferecem proteções equivalentes às exigidas neste CTD:
      </p>
      <ul style={SL.ul}>
        <li><strong>Supabase Inc.</strong> (EUA) — armazenamento de dados, autenticação e banco de dados. Transferência amparada em Cláusulas Contratuais Padrão.</li>
        <li><strong>Vercel Inc.</strong> (EUA) — hospedagem da aplicação. Transferência amparada em Cláusulas Contratuais Padrão.</li>
        <li><strong>Mercado Pago S.A.</strong> (Brasil) — processamento de pagamentos.</li>
        <li><strong>CloudWalk Inc. / InfinitePay</strong> (Brasil) — processamento de pagamentos via maquininha.</li>
        <li><strong>Tecnospeed S.A. / Focus NFe</strong> (Brasil) — emissão de documentos fiscais eletrônicos.</li>
      </ul>
      <p style={SL.p}>Qualquer alteração nesta lista será comunicada ao Controlador com antecedência mínima de 30 dias, permitindo que o Controlador se oponha fundamentadamente.</p>

      {/* 8 */}
      <h2 style={SL.h2}>8. Transferências internacionais</h2>
      <p style={SL.p}>
        Os suboperadores Supabase e Vercel estão sediados nos EUA. As transferências internacionais são realizadas com base em Cláusulas Contratuais Padrão (SCCs) e, nos casos aplicáveis, nas garantias previstas no art. 33 da LGPD.
      </p>

      {/* 9 */}
      <h2 style={SL.h2}>9. Retenção e exclusão de dados</h2>
      <p style={SL.p}>Ao término do contrato:</p>
      <ul style={SL.ul}>
        <li>O Controlador tem até 90 dias para solicitar a exportação dos seus dados via painel ou e-mail.</li>
        <li>Após esse prazo, os dados são excluídos permanentemente, exceto os que o Operador é obrigado a reter por lei (ex: registros fiscais por 5 anos).</li>
        <li>Dados sensíveis de saúde são excluídos em prazo razoável e tecnicamente viável após o término do contrato ou revogação do consentimento pelo titular, o que ocorrer primeiro, respeitadas quaisquer obrigações legais de retenção.</li>
      </ul>

      {/* 10 */}
      <h2 style={SL.h2}>10. Medidas de segurança</h2>
      <p style={SL.p}>O Operador mantém as seguintes medidas técnicas e organizacionais:</p>
      <ul style={SL.ul}>
        <li>Criptografia em trânsito (TLS 1.2+) e em repouso (AES-256 via Supabase)</li>
        <li>Row-Level Security (RLS) no banco de dados — cada salão acessa apenas seus próprios dados</li>
        <li>Controle de acesso baseado em função (RBAC) com princípio do menor privilégio</li>
        <li>Autenticação multifator disponível para contas de administrador</li>
        <li>Monitoramento contínuo de acessos e alertas de anomalias</li>
        <li>Revisões periódicas de segurança e políticas de RLS</li>
      </ul>

      {/* 11 */}
      <h2 style={SL.h2}>11. Auditoria</h2>
      <p style={SL.p}>
        O Controlador pode solicitar informações sobre as medidas de segurança implementadas e o cumprimento deste CTD mediante solicitação escrita para <strong>privacidade@luarys.com.br</strong>. O Operador responderá no prazo de 15 dias úteis. Auditorias in loco estão sujeitas a agendamento prévio, limitadas a uma por ano, e aos custos sendo de responsabilidade do Controlador.
      </p>

      {/* 12 */}
      <h2 style={SL.h2}>12. Responsabilidade</h2>
      <p style={SL.p}>
        Cada parte é responsável pelas violações da LGPD que decorram de atos ou omissões sob seu controle. Se o Operador tratar dados em desconformidade com as instruções do Controlador ou com as obrigações deste CTD, o Operador responderá pelos danos causados, na medida de sua culpabilidade. Se o Controlador der instruções ilegais ou não cumprir as suas próprias obrigações (como não obter consentimento para dados sensíveis), o Controlador responderá pelos danos decorrentes.
      </p>

      {/* 13 */}
      <h2 style={SL.h2}>13. Disposições gerais</h2>
      <ul style={SL.ul}>
        <li>Este CTD integra e prevalece sobre os Termos de Uso em matéria de proteção de dados.</li>
        <li>Qualquer alteração a este CTD será notificada com antecedência mínima de 30 dias. O uso continuado após a data de vigência implica aceitação.</li>
        <li>Este CTD é regido pela legislação brasileira, em especial a LGPD, com foro eleito em <strong>[CIDADE DA SEDE]</strong>.</li>
      </ul>

      {/* 14 */}
      <h2 style={SL.h2}>14. Contato</h2>
      <div style={SL.box}>
        <p style={{ ...SL.p, margin: '0 0 4px' }}><strong>Encarregado de Dados (DPO):</strong> [NOME DO DPO]</p>
        <p style={{ ...SL.p, margin: '0 0 4px' }}><strong>E-mail:</strong> privacidade@luarys.com.br</p>
        <p style={{ ...SL.p, margin: 0 }}><strong>Endereço:</strong> [ENDEREÇO COMPLETO]</p>
      </div>

    </PaginaLegal>
  );
}

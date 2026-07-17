import sanitizeHtml from 'sanitize-html';
import { createClient } from '@supabase/supabase-js';
import { PaginaLegal, SL } from '@/components/PaginaLegal';

export const revalidate = 3600;

export const metadata = {
  title: 'Termos de Uso — Luarys',
  description: 'Condições gerais de uso da plataforma Luarys.',
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
      .eq('tipo', 'termos_uso')
      .eq('ativo', true)
      .maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
}

export default async function TermosDeUso() {
  const doc = await getDoc();

  if (doc?.conteudo) {
    const atualizado = new Date(doc.atualizado_em).toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
    return (
      <PaginaLegal titulo={doc.titulo || 'Termos de Uso'} atualizadoEm={atualizado}>
        <div className="legal-content" dangerouslySetInnerHTML={{ __html: sanitizeHtml(doc.conteudo, { allowedTags: sanitizeHtml.defaults.allowedTags.concat(['h1', 'h2', 'h3', 'img']), allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes, '*': ['style', 'class'] } }) }} />
      </PaginaLegal>
    );
  }

  return (
    <PaginaLegal titulo="Termos de Uso" atualizadoEm="22 de junho de 2026">

      <p style={SL.p}>
        Estes Termos de Uso ("Termos") regulam o acesso e uso da plataforma Luarys, operada pela <strong>[RAZÃO SOCIAL DA EMPRESA]</strong>, CNPJ <strong>[CNPJ]</strong> ("Luarys", "nós"). Ao criar uma conta ou usar qualquer funcionalidade da plataforma, você ("Usuário") aceita integralmente estes Termos. Se agir em nome de uma empresa, declara ter poderes para vinculá-la.
      </p>

      {/* 1 */}
      <h2 style={SL.h2}>1. O que é o Luarys</h2>
      <p style={SL.p}>
        O Luarys é uma plataforma de gestão para salões de beleza e estética que oferece: agenda digital, controle financeiro, emissão de notas fiscais (NFS-e e NFC-e), portal de agendamento para clientes finais, controle de estoque e relatórios gerenciais.
      </p>
      <p style={SL.p}>
        O Luarys é um software como serviço (SaaS) — não fornecemos os serviços de beleza, apenas a ferramenta tecnológica para que os salões os gerenciem. Qualquer relação entre o salão e seus clientes é de responsabilidade exclusiva do salão.
      </p>

      {/* 2 */}
      <h2 style={SL.h2}>2. Tipos de usuário</h2>
      <ul style={SL.ul}>
        <li><strong>Lojista (Dono do salão)</strong> — contrata o plano, gerencia a unidade e é responsável pelo cumprimento destes Termos por toda a sua equipe.</li>
        <li><strong>Funcionário</strong> — acessa a plataforma com permissões definidas pelo Lojista.</li>
        <li><strong>Cliente final</strong> — usa o portal de agendamento para marcar serviços. Não contrata o Luarys diretamente; a relação contratual é com o salão.</li>
      </ul>

      {/* 3 */}
      <h2 style={SL.h2}>3. Cadastro e conta</h2>
      <p style={SL.p}>Para usar o Luarys como Lojista você deve:</p>
      <ul style={SL.ul}>
        <li>Fornecer informações verídicas, completas e atualizadas no cadastro.</li>
        <li>Manter a confidencialidade da senha e não compartilhá-la.</li>
        <li>Notificar imediatamente o Luarys em caso de acesso não autorizado.</li>
        <li>Ter capacidade legal para contratar (ser maior de 18 anos ou representante legal de pessoa jurídica).</li>
      </ul>
      <p style={SL.p}>O Luarys se reserva o direito de recusar ou cancelar cadastros que violem estes Termos ou a legislação vigente.</p>

      {/* 4 */}
      <h2 style={SL.h2}>4. Obrigações do usuário</h2>
      <p style={SL.p}>Ao usar a plataforma, o Usuário se compromete a:</p>
      <ul style={SL.ul}>
        <li>Usar o serviço apenas para fins lícitos e compatíveis com sua finalidade.</li>
        <li>Não tentar acessar dados de outros salões ou usuários.</li>
        <li>Manter os dados cadastrais (CNPJ, endereço, e-mail) sempre atualizados.</li>
        <li>Cumprir a legislação fiscal aplicável ao usar os módulos de emissão de notas.</li>
        <li>Obter o consentimento dos clientes finais antes de coletar dados de saúde via ficha de anamnese.</li>
        <li>Não usar a plataforma para armazenar dados de terceiros sem base legal adequada.</li>
        <li>Utilizar quaisquer ferramentas de comunicação (WhatsApp, SMS, e-mail) em conformidade com a legislação anti-spam aplicável (Lei 12.965/2014 — Marco Civil da Internet) e com as políticas dos respectivos canais, enviando mensagens apenas a destinatários que tenham consentido.</li>
      </ul>

      {/* 5 */}
      <h2 style={SL.h2}>5. Usos proibidos</h2>
      <p style={SL.p}>É expressamente vedado:</p>
      <ul style={SL.ul}>
        <li>Realizar engenharia reversa, descompilar ou tentar extrair o código-fonte da plataforma.</li>
        <li>Usar scripts automatizados, bots ou crawlers para acessar o sistema.</li>
        <li>Carregar vírus, malware ou qualquer conteúdo danoso.</li>
        <li>Usar o Luarys para fraudes fiscais, lavagem de dinheiro ou qualquer atividade ilícita.</li>
        <li>Revender, sublicenciar ou ceder o acesso à plataforma a terceiros sem autorização escrita.</li>
        <li>Interferir na infraestrutura ou na segurança da plataforma.</li>
      </ul>

      {/* 6 */}
      <h2 style={SL.h2}>6. Pagamento e faturamento</h2>
      <p style={SL.p}>
        O acesso ao Luarys está condicionado ao pagamento da assinatura conforme o plano contratado. O valor, a periodicidade e as condições de reajuste estão descritos na proposta comercial aceita no momento do cadastro ou na tela de planos da plataforma.
      </p>
      <ul style={SL.ul}>
        <li>O não pagamento na data de vencimento pode resultar em suspensão automática do acesso após 7 (sete) dias de atraso.</li>
        <li>Os preços podem ser reajustados anualmente pelo IPCA ou índice equivalente, com aviso prévio de 30 dias.</li>
        <li>Não há reembolso proporcional em caso de cancelamento antecipado, salvo disposição diversa em contrato específico.</li>
        <li>Taxas cobradas por gateways de pagamento (Mercado Pago, InfinitePay) são de responsabilidade do Lojista.</li>
      </ul>

      {/* 7 */}
      <h2 style={SL.h2}>7. Suspensão e encerramento</h2>
      <p style={SL.p}><strong>Pelo Usuário:</strong> o cancelamento pode ser solicitado a qualquer momento pelo painel ou por e-mail para contato@luarys.com.br. O acesso é mantido até o fim do período já pago.</p>
      <p style={SL.p}><strong>Pelo Luarys:</strong> podemos suspender ou encerrar o acesso imediatamente em caso de violação destes Termos, atividade fraudulenta ou determinação judicial, sem prejuízo de outras medidas legais.</p>
      <p style={SL.p}><strong>Exportação de dados:</strong> após o encerramento, o Lojista tem 90 dias para solicitar exportação dos seus dados via painel ou solicitação formal. Após esse prazo, os dados identificadores são anonimizados e os registros fiscais/financeiros são preservados sem vínculo nominal, conforme obrigação legal.</p>
      <p style={SL.p}><strong>Contas inativas:</strong> contas sem acesso por período superior a 24 meses poderão ser encerradas pelo Luarys mediante aviso prévio de 30 dias por e-mail cadastrado.</p>

      {/* 8 */}
      <h2 style={SL.h2}>8. Disponibilidade e suporte</h2>
      <p style={SL.p}>
        O Luarys empenha-se em manter a plataforma disponível 24/7, mas não garante disponibilidade ininterrupta. Manutenções programadas serão comunicadas com antecedência mínima de 24 horas, quando possível. Incidentes críticos serão comunicados pelo status da plataforma e por e-mail.
      </p>
      <p style={SL.p}>O suporte técnico é prestado por e-mail e canal indicado no painel. Tempo de resposta estimado: 1 dia útil para planos padrão.</p>

      {/* 9 */}
      <h2 style={SL.h2}>9. Propriedade intelectual</h2>
      <p style={SL.p}>
        Todo o código, design, marca, textos e conteúdo da plataforma Luarys são propriedade exclusiva da empresa ou de seus licenciantes. O uso da plataforma não transfere nenhum direito de propriedade intelectual ao Usuário.
      </p>
      <p style={SL.p}>
        Os dados inseridos pelo Lojista (cadastros de clientes, agendamentos, etc.) pertencem ao Lojista. O Luarys usa esses dados apenas para prestação do serviço contratado, conforme a Política de Privacidade.
      </p>

      {/* 10 */}
      <h2 style={SL.h2}>10. Limitação de responsabilidade</h2>
      <p style={SL.p}>O Luarys não se responsabiliza por:</p>
      <ul style={SL.ul}>
        <li>Danos decorrentes de uso indevido da plataforma pelo Usuário.</li>
        <li>Erros ou rejeições na emissão de notas fiscais causados por dados incorretos fornecidos pelo Lojista.</li>
        <li>Indisponibilidade de serviços de terceiros (SEFAZ, prefeituras, gateways de pagamento), incluindo rejeição ou atraso na emissão de NFS-e e NFC-e decorrente de instabilidade dos sistemas fiscais municipais, estaduais ou federais, que estão fora do controle técnico do Luarys.</li>
        <li>Perda de receita ou danos indiretos decorrentes de indisponibilidade da plataforma.</li>
        <li>Relações entre o salão e seus clientes finais.</li>
      </ul>
      <p style={SL.p}>
        Em qualquer hipótese, a responsabilidade máxima do Luarys limita-se ao valor pago pelo Usuário nos 3 (três) meses anteriores ao evento que deu origem à reclamação.
      </p>

      {/* 11 */}
      <h2 style={SL.h2}>11. Tratamento de dados pessoais</h2>
      <p style={SL.p}>
        O tratamento de dados pessoais realizado pelo Luarys é regido pela <a href="/privacidade" style={{ color: '#2C3643', fontWeight: 600 }}>Política de Privacidade</a>, incorporada a estes Termos por referência. O Lojista, ao usar o módulo de clientes finais, torna-se controlador dos dados desses clientes e é responsável por cumprir a LGPD em relação a eles.
      </p>

      {/* 12 */}
      <h2 style={SL.h2}>12. Disposições gerais</h2>
      <ul style={SL.ul}>
        <li><strong>Lei aplicável:</strong> estes Termos são regidos pela legislação brasileira.</li>
        <li><strong>Foro:</strong> fica eleito o foro da comarca de <strong>[CIDADE DA SEDE]</strong>, com renúncia expressa a qualquer outro, por mais privilegiado que seja.</li>
        <li><strong>Integralidade:</strong> estes Termos, juntamente com a Política de Privacidade e eventuais aditivos, constituem o acordo integral entre as partes.</li>
        <li><strong>Nulidade parcial:</strong> se qualquer disposição for considerada inválida, as demais permanecem em pleno vigor.</li>
        <li><strong>Ausência de renúncia:</strong> a tolerância do Luarys a qualquer descumprimento não implica renúncia ao direito de exigir o cumprimento futuro.</li>
      </ul>

      {/* 13 */}
      <h2 style={SL.h2}>13. Contato</h2>
      <div style={SL.box}>
        <p style={{ ...SL.p, margin: '0 0 4px' }}><strong>E-mail geral:</strong> contato@luarys.com.br</p>
        <p style={{ ...SL.p, margin: '0 0 4px' }}><strong>Privacidade e dados:</strong> privacidade@luarys.com.br</p>
        <p style={{ ...SL.p, margin: 0 }}><strong>Endereço:</strong> [ENDEREÇO COMPLETO]</p>
      </div>

    </PaginaLegal>
  );
}

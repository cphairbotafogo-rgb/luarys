-- Seed: conteúdo inicial dos documentos legais públicos
-- Execute no SQL Editor do Supabase (yojtfrgoosapnsvyzgpw)
-- Substitua [RAZÃO SOCIAL], [CNPJ], [CIDADE DA SEDE], [ENDEREÇO COMPLETO], [NOME DO DPO]
-- antes ou depois de publicar pelo Admin.

-- ─── TERMOS DE USO ───────────────────────────────────────────────────────────
INSERT INTO plataforma_documentos (tipo, titulo, conteudo, versao, ativo)
VALUES (
  'termos_uso',
  'Termos de Uso — Luarys',
  $HTML$<p>Estes Termos de Uso ("Termos") regulam o acesso e uso da plataforma Luarys, operada pela <strong>[RAZÃO SOCIAL DA EMPRESA]</strong>, CNPJ <strong>[CNPJ]</strong> ("Luarys", "nós"). Ao criar uma conta ou usar qualquer funcionalidade da plataforma, você ("Usuário") aceita integralmente estes Termos.</p>

<h2>1. O que é o Luarys</h2>
<p>O Luarys é uma plataforma de gestão para salões de beleza e estética que oferece: agenda digital, controle financeiro, emissão de notas fiscais (NFS-e e NFC-e), portal de agendamento para clientes finais, controle de estoque e relatórios gerenciais.</p>
<p>O Luarys é um software como serviço (SaaS) — não fornecemos os serviços de beleza, apenas a ferramenta tecnológica para que os salões os gerenciem. Qualquer relação entre o salão e seus clientes é de responsabilidade exclusiva do salão.</p>

<h2>2. Tipos de usuário</h2>
<ul>
  <li><strong>Lojista (Dono do salão)</strong> — contrata o plano, gerencia a unidade e é responsável pelo cumprimento destes Termos por toda a sua equipe.</li>
  <li><strong>Funcionário</strong> — acessa a plataforma com permissões definidas pelo Lojista.</li>
  <li><strong>Cliente final</strong> — usa o portal de agendamento para marcar serviços. Não contrata o Luarys diretamente; a relação contratual é com o salão.</li>
</ul>

<h2>3. Cadastro e conta</h2>
<p>Para usar o Luarys como Lojista você deve:</p>
<ul>
  <li>Fornecer informações verídicas, completas e atualizadas no cadastro.</li>
  <li>Manter a confidencialidade da senha e não compartilhá-la.</li>
  <li>Notificar imediatamente o Luarys em caso de acesso não autorizado.</li>
  <li>Ter capacidade legal para contratar (ser maior de 18 anos ou representante legal de pessoa jurídica).</li>
</ul>
<p>O Luarys se reserva o direito de recusar ou cancelar cadastros que violem estes Termos ou a legislação vigente.</p>

<h2>4. Obrigações do usuário</h2>
<ul>
  <li>Usar o serviço apenas para fins lícitos e compatíveis com sua finalidade.</li>
  <li>Não tentar acessar dados de outros salões ou usuários.</li>
  <li>Manter os dados cadastrais (CNPJ, endereço, e-mail) sempre atualizados.</li>
  <li>Cumprir a legislação fiscal aplicável ao usar os módulos de emissão de notas.</li>
  <li>Obter o consentimento dos clientes finais antes de coletar dados de saúde via ficha de anamnese.</li>
  <li>Utilizar ferramentas de comunicação apenas com destinatários que tenham consentido, conforme Lei 12.965/2014.</li>
</ul>

<h2>5. Usos proibidos</h2>
<ul>
  <li>Realizar engenharia reversa, descompilar ou tentar extrair o código-fonte da plataforma.</li>
  <li>Usar scripts automatizados, bots ou crawlers para acessar o sistema.</li>
  <li>Carregar vírus, malware ou qualquer conteúdo danoso.</li>
  <li>Usar o Luarys para fraudes fiscais, lavagem de dinheiro ou qualquer atividade ilícita.</li>
  <li>Revender, sublicenciar ou ceder o acesso à plataforma a terceiros sem autorização escrita.</li>
</ul>

<h2>6. Pagamento e faturamento</h2>
<p>O acesso ao Luarys está condicionado ao pagamento da assinatura conforme o plano contratado.</p>
<ul>
  <li>O não pagamento pode resultar em suspensão automática após 7 dias de atraso.</li>
  <li>Os preços podem ser reajustados anualmente pelo IPCA, com aviso prévio de 30 dias.</li>
  <li>Não há reembolso proporcional em caso de cancelamento antecipado.</li>
  <li>Taxas cobradas por gateways de pagamento são de responsabilidade do Lojista.</li>
</ul>

<h2>7. Suspensão e encerramento</h2>
<p><strong>Pelo Usuário:</strong> o cancelamento pode ser solicitado a qualquer momento pelo painel ou por e-mail para contato@luarys.com.br. O acesso é mantido até o fim do período já pago.</p>
<p><strong>Pelo Luarys:</strong> podemos suspender ou encerrar o acesso imediatamente em caso de violação destes Termos, atividade fraudulenta ou determinação judicial.</p>
<p><strong>Exportação de dados:</strong> após o encerramento, o Lojista tem 90 dias para solicitar exportação dos seus dados.</p>

<h2>8. Disponibilidade e suporte</h2>
<p>O Luarys empenha-se em manter a plataforma disponível 24/7. Manutenções programadas serão comunicadas com antecedência mínima de 24 horas. O suporte técnico é prestado por e-mail com tempo de resposta estimado de 1 dia útil.</p>

<h2>9. Propriedade intelectual</h2>
<p>Todo o código, design, marca, textos e conteúdo da plataforma Luarys são propriedade exclusiva da empresa ou de seus licenciantes. Os dados inseridos pelo Lojista pertencem ao Lojista.</p>

<h2>10. Limitação de responsabilidade</h2>
<p>O Luarys não se responsabiliza por:</p>
<ul>
  <li>Danos decorrentes de uso indevido da plataforma pelo Usuário.</li>
  <li>Erros na emissão de notas fiscais causados por dados incorretos fornecidos pelo Lojista.</li>
  <li>Indisponibilidade de serviços de terceiros (SEFAZ, prefeituras, gateways de pagamento).</li>
  <li>Perda de receita ou danos indiretos decorrentes de indisponibilidade da plataforma.</li>
</ul>
<p>Em qualquer hipótese, a responsabilidade máxima do Luarys limita-se ao valor pago pelo Usuário nos 3 meses anteriores ao evento.</p>

<h2>11. Tratamento de dados pessoais</h2>
<p>O tratamento de dados pessoais é regido pela <a href="/privacidade">Política de Privacidade</a>, incorporada a estes Termos por referência.</p>

<h2>12. Disposições gerais</h2>
<ul>
  <li><strong>Lei aplicável:</strong> estes Termos são regidos pela legislação brasileira.</li>
  <li><strong>Foro:</strong> fica eleito o foro da comarca de <strong>[CIDADE DA SEDE]</strong>.</li>
  <li><strong>Integralidade:</strong> estes Termos, juntamente com a Política de Privacidade, constituem o acordo integral entre as partes.</li>
</ul>

<h2>13. Contato</h2>
<div class="box">
  <p><strong>E-mail geral:</strong> contato@luarys.com.br</p>
  <p><strong>Privacidade e dados:</strong> privacidade@luarys.com.br</p>
  <p><strong>Endereço:</strong> [ENDEREÇO COMPLETO]</p>
</div>$HTML$,
  1, true
);

-- ─── POLÍTICA DE PRIVACIDADE ─────────────────────────────────────────────────
INSERT INTO plataforma_documentos (tipo, titulo, conteudo, versao, ativo)
VALUES (
  'privacidade',
  'Política de Privacidade — Luarys',
  $HTML$<p>Esta Política de Privacidade descreve como a <strong>[RAZÃO SOCIAL DA EMPRESA]</strong>, CNPJ <strong>[CNPJ]</strong>, com sede em <strong>[ENDEREÇO COMPLETO]</strong> ("Luarys", "nós"), coleta, usa, armazena e compartilha dados pessoais, em conformidade com a LGPD (Lei 13.709/2018).</p>

<h2>1. Quem é o controlador dos dados</h2>
<p>O Luarys atua como <strong>controlador</strong> dos dados dos lojistas e dos clientes finais que usam o portal de agendamento. Para os dados dos clientes finais dos salões, o salão é o controlador e o Luarys atua como <strong>operador</strong>.</p>

<h2>2. Dados que coletamos</h2>
<div class="box">
  <p><strong>Lojistas (donos e funcionários de salão)</strong></p>
  <ul>
    <li>Nome completo, e-mail, telefone e senha (hash)</li>
    <li>CNPJ, razão social, inscrição municipal/estadual, endereço do estabelecimento</li>
    <li>Dados bancários para fins de pagamento de assinatura</li>
    <li>Logs de acesso (IP, horário, ação realizada) para segurança e auditoria</li>
  </ul>
</div>
<div class="box">
  <p><strong>Clientes finais dos salões (portal de agendamento)</strong></p>
  <ul>
    <li>Nome, e-mail, telefone e CPF</li>
    <li>Histórico de agendamentos e serviços realizados</li>
    <li>Dados de saúde via ficha de anamnese — <strong>somente mediante consentimento explícito e separado</strong></li>
  </ul>
</div>
<div class="box">
  <p><strong>Dados coletados automaticamente</strong></p>
  <ul>
    <li>Endereço IP e identificador de sessão</li>
    <li>Tipo de dispositivo e navegador</li>
    <li>Cookies funcionais</li>
  </ul>
</div>

<h2>3. Finalidade e base legal</h2>
<ul>
  <li><span class="tag">Art. 7, V</span> <strong>Execução de contrato</strong> — criar e manter a conta, processar agendamentos, emitir notas fiscais, processar pagamentos.</li>
  <li><span class="tag">Art. 7, II</span> <strong>Obrigação legal</strong> — emissão de NFS-e e NFC-e, retenção de registros fiscais por 5 anos.</li>
  <li><span class="tag">Art. 11, I</span> <strong>Consentimento explícito</strong> — coleta de dados de saúde nas fichas de anamnese.</li>
  <li><span class="tag">Art. 7, IX</span> <strong>Legítimo interesse</strong> — prevenção a fraudes, segurança da plataforma, melhoria do serviço.</li>
</ul>

<h2>4. Compartilhamento com terceiros</h2>
<p>Não vendemos nem alugamos dados pessoais. Subprocessadores atuais:</p>
<ul>
  <li><strong>Supabase Inc.</strong> (EUA) — banco de dados, autenticação e armazenamento.</li>
  <li><strong>Mercado Pago S.A.</strong> (Brasil) — processamento de pagamentos.</li>
  <li><strong>InfinitePay / CloudWalk Inc.</strong> (Brasil) — pagamentos via maquininha.</li>
  <li><strong>Tecnospeed S.A. (Focus NFe)</strong> (Brasil) — emissão de NFS-e e NFC-e.</li>
  <li><strong>Vercel Inc.</strong> (EUA) — hospedagem da aplicação web.</li>
</ul>

<h2>5. Transferências internacionais</h2>
<p>Supabase e Vercel estão nos EUA. Transferências realizadas com base em Cláusulas Contratuais Padrão (SCCs), conforme art. 33 da LGPD.</p>

<h2>6. Retenção de dados</h2>
<ul>
  <li><strong>Dados fiscais:</strong> mínimo de 5 anos por obrigação legal.</li>
  <li><strong>Dados de saúde:</strong> pelo prazo consentido ou enquanto a conta estiver ativa.</li>
  <li><strong>Conta ativa:</strong> durante a vigência do contrato e por 90 dias após o encerramento.</li>
  <li><strong>Logs de segurança:</strong> 12 meses.</li>
</ul>

<h2>7. Seus direitos (LGPD, art. 18)</h2>
<ul>
  <li><strong>Acesso</strong> — saber quais dados temos sobre você.</li>
  <li><strong>Correção</strong> — corrigir dados incompletos ou inexatos.</li>
  <li><strong>Portabilidade</strong> — receber seus dados em formato estruturado.</li>
  <li><strong>Eliminação</strong> — excluir dados tratados com base em consentimento.</li>
  <li><strong>Revogação do consentimento</strong> — retirar o consentimento a qualquer momento.</li>
</ul>
<p>Para exercer qualquer direito, envie solicitação para <strong>privacidade@luarys.com.br</strong>. Responderemos em até 15 dias úteis.</p>

<h2>8. Cookies e rastreamento</h2>
<p>Utilizamos apenas cookies estritamente necessários ao funcionamento da plataforma: sessão de autenticação e preferências de interface. Não utilizamos cookies de rastreamento publicitário.</p>

<h2>9. Segurança</h2>
<p>Adotamos criptografia em trânsito (TLS 1.2+) e em repouso, controle de acesso por função (RBAC), Row-Level Security no banco de dados, autenticação multifator disponível e monitoramento contínuo de acessos suspeitos.</p>

<h2>10. Menores de idade</h2>
<p>O portal pode ser utilizado por pessoas a partir de 13 anos, com consentimento do responsável legal para titulares entre 13 e 17 anos. Não coletamos intencionalmente dados de crianças menores de 12 anos.</p>

<h2>11. Alterações nesta política</h2>
<p>Podemos atualizar esta Política periodicamente. Quando as alterações forem relevantes, notificaremos os usuários por e-mail ou aviso na plataforma com antecedência mínima de 15 dias.</p>

<h2>12. Contato e Encarregado de Dados (DPO)</h2>
<div class="box">
  <p><strong>Encarregado de Proteção de Dados:</strong> [NOME DO DPO]</p>
  <p><strong>E-mail:</strong> privacidade@luarys.com.br</p>
  <p><strong>Endereço:</strong> [ENDEREÇO COMPLETO]</p>
</div>
<p>Você também pode apresentar reclamação à Autoridade Nacional de Proteção de Dados (ANPD) pelo site <strong>gov.br/anpd</strong>.</p>$HTML$,
  1, true
);

-- ─── DPA / CONTRATO DE TRATAMENTO DE DADOS ───────────────────────────────────
INSERT INTO plataforma_documentos (tipo, titulo, conteudo, versao, ativo)
VALUES (
  'dpa',
  'Contrato de Tratamento de Dados (CTD/DPA) — Luarys',
  $HTML$<p>Este Contrato de Tratamento de Dados ("CTD" ou "DPA") é celebrado entre a <strong>[RAZÃO SOCIAL DA EMPRESA]</strong>, CNPJ <strong>[CNPJ]</strong> ("Luarys" ou "Operador") e o salão ou estabelecimento que utiliza a plataforma Luarys ("Controlador"), nos termos da LGPD (Lei 13.709/2018).</p>
<p>Este CTD é incorporado e forma parte integrante dos <a href="/termos">Termos de Uso</a>. Ao aceitar os Termos de Uso, o Controlador também aceita as condições deste CTD.</p>

<h2>1. Definições</h2>
<ul>
  <li><strong>Controlador:</strong> o salão ou estabelecimento que decide como e por que os dados pessoais dos seus clientes são tratados.</li>
  <li><strong>Operador:</strong> a Luarys, que trata dados pessoais em nome e conforme as instruções do Controlador.</li>
  <li><strong>Titular:</strong> os clientes finais do salão cujos dados são tratados na plataforma.</li>
  <li><strong>Dados Pessoais Sensíveis:</strong> dados de saúde coletados via ficha de anamnese (LGPD, art. 5º, II).</li>
</ul>

<h2>2. Objeto e natureza do tratamento</h2>
<p>A Luarys tratará dados pessoais dos clientes do Controlador exclusivamente para viabilizar as funcionalidades contratadas: gestão de agendamentos, histórico de serviços, ficha técnica/anamnese, emissão de notas fiscais, processamento de pagamentos e comunicações operacionais.</p>

<h2>3. Tipos de dados e categorias de titulares</h2>
<div class="box">
  <p><strong>Dados tratados pelo Operador em nome do Controlador:</strong></p>
  <ul>
    <li>Dados de identificação: nome completo, CPF, e-mail, telefone</li>
    <li>Dados de serviço: histórico de agendamentos, serviços realizados, profissional responsável</li>
    <li>Dados sensíveis de saúde: informações de anamnese — somente quando o Controlador habilitar este módulo e o titular consentir</li>
    <li>Dados financeiros: pagamentos realizados, histórico de compras na vitrine</li>
  </ul>
</div>

<h2>4. Vigência</h2>
<p>Este CTD vigora pelo mesmo período do contrato de serviço entre as partes.</p>

<h2>5. Obrigações do Operador (Luarys)</h2>
<ul>
  <li>Tratar os dados pessoais apenas conforme as instruções documentadas do Controlador.</li>
  <li>Garantir que colaboradores e sistemas com acesso estão sujeitos a obrigações de confidencialidade.</li>
  <li>Implementar medidas técnicas e organizacionais adequadas para proteger os dados.</li>
  <li>Notificar o Controlador em até 2 dias úteis após tomar conhecimento de incidente de segurança.</li>
  <li>Auxiliar o Controlador no atendimento de requisições de direitos dos titulares.</li>
  <li>Encerrar o tratamento e excluir os dados ao término do contrato, salvo obrigação legal de retenção.</li>
</ul>

<h2>6. Obrigações do Controlador (Salão)</h2>
<ul>
  <li>Garantir que possui base legal adequada para tratar os dados pessoais dos seus clientes.</li>
  <li>Obter consentimento explícito e informado dos titulares antes de coletar dados sensíveis de saúde.</li>
  <li>Informar os titulares sobre o uso da plataforma Luarys como ferramenta de gestão.</li>
  <li>Atender com presteza as requisições de direitos dos seus clientes.</li>
</ul>

<h2>7. Suboperadores aprovados</h2>
<ul>
  <li><strong>Supabase Inc.</strong> (EUA) — armazenamento, autenticação e banco de dados.</li>
  <li><strong>Vercel Inc.</strong> (EUA) — hospedagem da aplicação.</li>
  <li><strong>Mercado Pago S.A.</strong> (Brasil) — processamento de pagamentos.</li>
  <li><strong>CloudWalk Inc. / InfinitePay</strong> (Brasil) — pagamentos via maquininha.</li>
  <li><strong>Tecnospeed S.A. / Focus NFe</strong> (Brasil) — emissão de documentos fiscais.</li>
</ul>

<h2>8. Transferências internacionais</h2>
<p>Supabase e Vercel estão nos EUA. Transferências realizadas com base em Cláusulas Contratuais Padrão, conforme art. 33 da LGPD.</p>

<h2>9. Retenção e exclusão de dados</h2>
<ul>
  <li>O Controlador tem até 90 dias após o encerramento para solicitar exportação dos dados.</li>
  <li>Após esse prazo, os dados são excluídos permanentemente, exceto os que o Operador é obrigado a reter por lei.</li>
  <li>Dados sensíveis de saúde são excluídos após o término do contrato ou revogação do consentimento.</li>
</ul>

<h2>10. Medidas de segurança</h2>
<ul>
  <li>Criptografia em trânsito (TLS 1.2+) e em repouso (AES-256 via Supabase)</li>
  <li>Row-Level Security (RLS) — cada salão acessa apenas seus próprios dados</li>
  <li>Controle de acesso baseado em função (RBAC)</li>
  <li>Autenticação multifator disponível para contas de administrador</li>
  <li>Monitoramento contínuo de acessos e alertas de anomalias</li>
</ul>

<h2>11. Auditoria</h2>
<p>O Controlador pode solicitar informações sobre as medidas de segurança mediante solicitação escrita para <strong>privacidade@luarys.com.br</strong>. O Operador responderá no prazo de 15 dias úteis.</p>

<h2>12. Responsabilidade</h2>
<p>Cada parte é responsável pelas violações da LGPD que decorram de atos ou omissões sob seu controle.</p>

<h2>13. Disposições gerais</h2>
<ul>
  <li>Este CTD integra e prevalece sobre os Termos de Uso em matéria de proteção de dados.</li>
  <li>Qualquer alteração será notificada com antecedência mínima de 30 dias.</li>
  <li>Este CTD é regido pela legislação brasileira, com foro eleito em <strong>[CIDADE DA SEDE]</strong>.</li>
</ul>

<h2>14. Contato</h2>
<div class="box">
  <p><strong>Encarregado de Dados (DPO):</strong> [NOME DO DPO]</p>
  <p><strong>E-mail:</strong> privacidade@luarys.com.br</p>
  <p><strong>Endereço:</strong> [ENDEREÇO COMPLETO]</p>
</div>$HTML$,
  1, true
);

-- ─── RLS: permitir leitura pública dos documentos legais ─────────────────────
-- Necessário para as páginas /termos, /privacidade e /dpa buscarem do banco.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'plataforma_documentos'
      AND policyname = 'leitura_publica_documentos_legais'
  ) THEN
    EXECUTE 'CREATE POLICY leitura_publica_documentos_legais
      ON plataforma_documentos FOR SELECT TO anon
      USING (ativo = true)';
  END IF;
END $$;

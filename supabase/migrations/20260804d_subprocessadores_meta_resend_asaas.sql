-- 20260804d_subprocessadores_meta_resend_asaas.sql
--
-- ⚠️ NÃO APLICAR SEM REVISAR — texto jurídico. Ver "ANTES DE APLICAR" no fim.
--
-- Completa a lista de subprocessadores/suboperadores com três serviços que já
-- recebem dado pessoal hoje e não estavam declarados em nenhum dos documentos.
-- A auditoria de 04/08/2026 levantou isso ao conferir a troca Focus NFe →
-- Brasil NFe (migration 20260804c).
--
-- O QUE CADA UM RECEBE (verificado no código, não presumido):
--
--   Meta (WhatsApp Business Platform)  — src/lib/whatsappEnviar.ts
--     Envia o TELEFONE do cliente final do salão + as variáveis do template
--     (nome, data, horário, serviço, profissional) para graph.facebook.com.
--
--   Resend                             — src/lib/notificarAgendamento.ts
--     Envia o E-MAIL e o nome do cliente final, com data/hora/serviço, como
--     fallback quando o WhatsApp falha ou o cliente não tem telefone.
--
--   Asaas                              — src/app/api/assinatura/*, whatsapp/comprar-creditos
--     Recebe nome, e-mail, CNPJ e telefone DO SALÃO (cobrança da assinatura do
--     Luarys e dos créditos de WhatsApp). NÃO recebe nada dos clientes do salão.
--
-- POR ISSO O ASAAS ENTRA SÓ NA POLÍTICA, NÃO NO DPA:
--   No DPA o salão é Controlador e o Luarys, Operador — a lista de suboperadores
--   trata de quem processa os dados DOS CLIENTES DO SALÃO. O Asaas não toca
--   nesses dados; ele processa dados do próprio salão, numa relação em que o
--   Luarys é o controlador. Na Política de Privacidade, que cobre todos os
--   titulares (inclusive o dono do salão), ele precisa constar.
--
-- Meta e Resend entram nos DOIS: tratam dado do cliente final do salão.
--
-- Idempotente: usa replace() ancorado em linhas estáveis e só altera as linhas
-- que ainda não citam os novos nomes (WHERE ... NOT LIKE).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) POLÍTICA DE PRIVACIDADE — acrescenta Meta, Resend e Asaas
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE plataforma_documentos
   SET conteudo = replace(
         conteudo,
         '<li><strong>Vercel Inc.</strong> (EUA) — hospedagem da aplicação web.</li>',
         '<li><strong>Vercel Inc.</strong> (EUA) — hospedagem da aplicação web.</li>' || E'\n' ||
         '  <li><strong>Meta Platforms</strong> (EUA/Irlanda) — envio de mensagens e confirmações pelo WhatsApp Business Platform. Recebe o telefone do cliente e os dados do agendamento (data, horário, serviço e profissional).</li>' || E'\n' ||
         '  <li><strong>Resend</strong> (EUA) — envio de e-mails transacionais de confirmação de agendamento. Recebe nome, e-mail e os dados do agendamento.</li>' || E'\n' ||
         '  <li><strong>Asaas</strong> (Brasil) — cobrança da assinatura do salão e dos créditos de WhatsApp. Recebe apenas dados do estabelecimento (razão social/nome fantasia, CNPJ, e-mail e telefone de contato) — nunca dados dos clientes do salão.</li>'
       ),
       atualizado_em = NOW()
 WHERE tipo = 'privacidade'
   AND conteudo LIKE '%<strong>Vercel Inc.</strong> (EUA) — hospedagem da aplicação web.%'
   AND conteudo NOT LIKE '%Meta Platforms%';

-- Transferências internacionais: Meta e Resend também estão nos EUA.
UPDATE plataforma_documentos
   SET conteudo = replace(
         conteudo,
         'Supabase e Vercel estão nos EUA.',
         'Supabase, Vercel, Meta Platforms e Resend estão sediados no exterior (EUA/Irlanda).'
       ),
       atualizado_em = NOW()
 WHERE tipo = 'privacidade'
   AND conteudo LIKE '%Supabase e Vercel estão nos EUA.%';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) DPA / CTD — acrescenta Meta e Resend (Asaas fica de fora, ver nota acima)
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE plataforma_documentos
   SET conteudo = replace(
         conteudo,
         '<li><strong>Brasil NFe Ltda.</strong> (Brasil) — emissão de documentos fiscais.</li>',
         '<li><strong>Brasil NFe Ltda.</strong> (Brasil) — emissão de documentos fiscais.</li>' || E'\n' ||
         '  <li><strong>Meta Platforms</strong> (EUA/Irlanda) — envio de mensagens ao cliente final pelo WhatsApp Business Platform. Transferência amparada em Cláusulas Contratuais Padrão.</li>' || E'\n' ||
         '  <li><strong>Resend</strong> (EUA) — envio de e-mails transacionais ao cliente final. Transferência amparada em Cláusulas Contratuais Padrão.</li>'
       ),
       atualizado_em = NOW()
 WHERE tipo = 'dpa'
   AND conteudo LIKE '%<strong>Brasil NFe Ltda.</strong> (Brasil) — emissão de documentos fiscais.%'
   AND conteudo NOT LIKE '%Meta Platforms%';

UPDATE plataforma_documentos
   SET conteudo = replace(
         conteudo,
         'Supabase e Vercel estão nos EUA.',
         'Supabase, Vercel, Meta Platforms e Resend estão sediados no exterior (EUA/Irlanda).'
       ),
       atualizado_em = NOW()
 WHERE tipo = 'dpa'
   AND conteudo LIKE '%Supabase e Vercel estão nos EUA.%';

-- ─────────────────────────────────────────────────────────────────────────────
-- ANTES DE APLICAR — três coisas que dependem de você, não do código:
--
--  1. RAZÃO SOCIAL. Usei os nomes comerciais (Meta Platforms, Resend, Asaas)
--     porque não tenho fonte verificada da entidade jurídica e do CNPJ/registro
--     de cada uma — e chutar isso num contrato é pior do que ser genérico.
--     (A exceção é "Brasil NFe Ltda.", confirmada no README do SDK oficial.)
--     Se o jurídico quiser a denominação completa, é só ajustar o texto aqui.
--
--  2. AVISO DE 30 DIAS. Tanto o DPA quanto a Política exigem comunicar os salões
--     com 30 dias de antecedência antes de mudar essa lista. Esta migration
--     altera o texto; o aviso é passo separado.
--
--  3. SÓ APLIQUE DEPOIS DA 20260804c. Os UPDATEs do DPA se ancoram na linha da
--     Brasil NFe, que é criada por aquela migration. Rodar fora de ordem não
--     quebra nada (o WHERE simplesmente não casa e 0 linhas são alteradas), mas
--     também não surte efeito.
--
-- Conferência (deve listar os três nomes nos documentos certos):
--   SELECT tipo,
--          conteudo LIKE '%Meta Platforms%' AS tem_meta,
--          conteudo LIKE '%Resend%'         AS tem_resend,
--          conteudo LIKE '%Asaas%'          AS tem_asaas
--     FROM plataforma_documentos WHERE tipo IN ('privacidade','dpa') AND ativo;
-- ─────────────────────────────────────────────────────────────────────────────

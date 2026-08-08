-- 20260804e_razao_social_subprocessadores.sql
--
-- Substitui os nomes COMERCIAIS usados na migration 20260804d pela denominação
-- jurídica de cada subprocessador, agora confirmada em fonte primária. Na 20260804d
-- eu havia deixado o nome comercial de propósito, por não ter fonte verificada —
-- esta migration fecha essa lacuna.
--
-- FONTES (consultadas em 04/08/2026):
--
--   Meta Platforms, Inc. — WhatsApp Business Platform Cloud API Terms, seção 1.2:
--     "if you are located in the United States, Canada, or Brazil" o contrato é com
--     Meta Platforms, Inc.; "if you are located elsewhere", com Meta Platforms
--     Ireland Limited.
--     https://www.facebook.com/legal/WhatsApp-Business-Platform-Cloud-API
--     ⚠️ CORREÇÃO IMPORTANTE: a 20260804d dizia "(EUA/Irlanda)". Está errado para
--     o nosso caso — o Luarys e os salões estão no BRASIL, e para o Brasil a
--     entidade é a americana, não a irlandesa. A menção à Irlanda sai do texto.
--
--   Plus Five Five, Inc. — Termos de Serviço do Resend:
--     "Plus Five Five, Inc. ('Company', 'We', 'Our', 'Us')", regido pelas leis do
--     estado da Califórnia. https://resend.com/legal/terms-of-service
--     ⚠️ "Resend" é o nome do PRODUTO; a pessoa jurídica é Plus Five Five, Inc.
--     Fica "Plus Five Five, Inc. (Resend)" para que o salão reconheça o serviço.
--
--   Asaas Gestão Financeira Instituição de Pagamento S.A. — CNPJ 19.540.550/0001-21,
--     sede em Joinville/SC, instituição de pagamento regulada pelo Banco Central.
--
--   Brasil NFe Ltda. — CNPJ 39.658.743/0001-99, informado no README do SDK oficial
--     `brasilnfe` (npm). Aproveita esta migration para acrescentar o CNPJ, que a
--     20260804c não trazia.
--
-- Os replaces são ancorados apenas no trecho <strong>...</strong> + país, então
-- funcionam independentemente do restante da descrição de cada item. Idempotente.

-- ── Meta: razão social + remoção da menção indevida à Irlanda ────────────────
UPDATE plataforma_documentos
   SET conteudo = replace(conteudo,
         '<strong>Meta Platforms</strong> (EUA/Irlanda)',
         '<strong>Meta Platforms, Inc.</strong> (EUA)'),
       atualizado_em = NOW()
 WHERE tipo IN ('privacidade', 'dpa')
   AND conteudo LIKE '%<strong>Meta Platforms</strong> (EUA/Irlanda)%';

-- ── Resend: pessoa jurídica é Plus Five Five, Inc. ──────────────────────────
UPDATE plataforma_documentos
   SET conteudo = replace(conteudo,
         '<strong>Resend</strong> (EUA)',
         '<strong>Plus Five Five, Inc. (Resend)</strong> (EUA)'),
       atualizado_em = NOW()
 WHERE tipo IN ('privacidade', 'dpa')
   AND conteudo LIKE '%<strong>Resend</strong> (EUA)%';

-- ── Asaas: razão social + CNPJ ──────────────────────────────────────────────
UPDATE plataforma_documentos
   SET conteudo = replace(conteudo,
         '<strong>Asaas</strong> (Brasil)',
         '<strong>Asaas Gestão Financeira Instituição de Pagamento S.A.</strong> (Brasil, CNPJ 19.540.550/0001-21)'),
       atualizado_em = NOW()
 WHERE tipo = 'privacidade'
   AND conteudo LIKE '%<strong>Asaas</strong> (Brasil)%';

-- ── Brasil NFe: acrescenta o CNPJ ───────────────────────────────────────────
UPDATE plataforma_documentos
   SET conteudo = replace(conteudo,
         '<strong>Brasil NFe Ltda.</strong> (Brasil)',
         '<strong>Brasil NFe Ltda.</strong> (Brasil, CNPJ 39.658.743/0001-99)'),
       atualizado_em = NOW()
 WHERE tipo IN ('privacidade', 'dpa')
   AND conteudo LIKE '%<strong>Brasil NFe Ltda.</strong> (Brasil)%'
   AND conteudo NOT LIKE '%39.658.743/0001-99%';

-- ── Transferências internacionais: só EUA, sem Irlanda ──────────────────────
UPDATE plataforma_documentos
   SET conteudo = replace(
         replace(conteudo,
           'Supabase, Vercel, Meta Platforms e Resend estão sediados no exterior (EUA/Irlanda).',
           'Supabase, Vercel, Meta Platforms e Plus Five Five (Resend) estão sediados nos Estados Unidos.'),
         '(Supabase, Vercel, Meta Platforms e Resend — EUA/Irlanda)',
         '(Supabase, Vercel, Meta Platforms e Plus Five Five/Resend — EUA)'),
       atualizado_em = NOW()
 WHERE tipo IN ('privacidade', 'dpa')
   AND conteudo LIKE '%EUA/Irlanda%';

-- Conferência: deve retornar 0 linhas (nenhuma menção residual à Irlanda).
--   SELECT tipo FROM plataforma_documentos
--    WHERE ativo AND (conteudo LIKE '%Irlanda%' OR conteudo LIKE '%<strong>Asaas</strong>%');

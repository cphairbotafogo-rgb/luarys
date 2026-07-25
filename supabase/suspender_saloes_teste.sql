-- Suspende (não apaga) os salões "BelezaBeleza" e "mateus" — mantém todos os
-- dados, só bloqueia o acesso, revertível a qualquer momento.
-- "Eleva Beauty Studio" foi excluído de propósito — é salão real, não mexer.

-- ═══════════════════════════════════════════════════════════════════════════
-- PASSO 1 — RODE ISSO PRIMEIRO E CONFIRA O RESULTADO ANTES DE SEGUIR
-- Mostra exatamente quais salões batem com os nomes — principalmente
-- "mateus" é um termo curto, pode bater com mais coisa do que você espera.
-- ═══════════════════════════════════════════════════════════════════════════
SELECT id, nome_fantasia, razao_social, cnpj, status_assinatura, email_contato
FROM saloes
WHERE nome_fantasia ILIKE '%belezabeleza%'
   OR nome_fantasia ILIKE '%mateus%'
   OR razao_social  ILIKE '%belezabeleza%'
   OR razao_social  ILIKE '%mateus%';

-- ═══════════════════════════════════════════════════════════════════════════
-- PASSO 2 — SÓ RODE DEPOIS DE CONFERIR QUE O PASSO 1 TROUXE SÓ OS SALÕES
-- CERTOS. Ajuste o WHERE aqui manualmente se precisar (ex: trocar por id
-- exato) antes de rodar, pra não suspender o salão errado.
-- ═══════════════════════════════════════════════════════════════════════════
-- UPDATE saloes
-- SET status_assinatura = 'suspenso'
-- WHERE nome_fantasia ILIKE '%belezabeleza%'
--    OR nome_fantasia ILIKE '%mateus%';

-- Pra reverter depois (reativar), rode:
-- UPDATE saloes SET status_assinatura = 'ativo' WHERE id IN ('<id1>', '<id2>');

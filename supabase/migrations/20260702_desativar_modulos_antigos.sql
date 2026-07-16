-- Remove duplicatas: desativa módulos antigos que foram substituídos
-- pelos novos canônicos (fiscal, comunicacao, crescimento, etc.).
-- NÃO deleta nada — apenas ativo = false para que não apareçam na UI.
-- Os salões ativos já têm as novas chaves em salao_modulos (migration anterior).

-- Migra salao_modulos com chaves antigas para as novas equivalentes,
-- antes de esconder os módulos antigos.

-- Chaves que mapeiam para 'fiscal' (NFS-e, NFC-e, notas fiscais)
INSERT INTO salao_modulos (salao_id, modulo_chave, ativo, origem, ativado_em)
SELECT DISTINCT sm.salao_id, 'fiscal', true, 'migracao_chave', now()
FROM salao_modulos sm
JOIN modulos_catalogo mc ON mc.chave = sm.modulo_chave
WHERE sm.ativo = true
  AND sm.modulo_chave NOT IN ('fiscal','comunicacao','crescimento','precificacao','financeiro','relatorios','estoque','fidelidade')
  AND (mc.nome ILIKE '%nfs%' OR mc.nome ILIKE '%nfc%' OR mc.nome ILIKE '%nota fiscal%' OR mc.nome ILIKE '%fiscal%')
ON CONFLICT (salao_id, modulo_chave) DO NOTHING;

-- Chaves que mapeiam para 'comunicacao' (WhatsApp, central, mensagem)
INSERT INTO salao_modulos (salao_id, modulo_chave, ativo, origem, ativado_em)
SELECT DISTINCT sm.salao_id, 'comunicacao', true, 'migracao_chave', now()
FROM salao_modulos sm
JOIN modulos_catalogo mc ON mc.chave = sm.modulo_chave
WHERE sm.ativo = true
  AND sm.modulo_chave NOT IN ('fiscal','comunicacao','crescimento','precificacao','financeiro','relatorios','estoque','fidelidade')
  AND (mc.nome ILIKE '%comunica%' OR mc.nome ILIKE '%whatsapp%' OR mc.nome ILIKE '%mensagem%' OR mc.nome ILIKE '%central%')
ON CONFLICT (salao_id, modulo_chave) DO NOTHING;

-- Chaves que mapeiam para 'crescimento' (growth, crescimento, receita)
INSERT INTO salao_modulos (salao_id, modulo_chave, ativo, origem, ativado_em)
SELECT DISTINCT sm.salao_id, 'crescimento', true, 'migracao_chave', now()
FROM salao_modulos sm
JOIN modulos_catalogo mc ON mc.chave = sm.modulo_chave
WHERE sm.ativo = true
  AND sm.modulo_chave NOT IN ('fiscal','comunicacao','crescimento','precificacao','financeiro','relatorios','estoque','fidelidade')
  AND (mc.nome ILIKE '%crescimento%' OR mc.nome ILIKE '%growth%' OR mc.nome ILIKE '%receita%' OR mc.nome ILIKE '%cresce%')
ON CONFLICT (salao_id, modulo_chave) DO NOTHING;

-- Chaves que mapeiam para 'precificacao' (preci, preço, flow, flex)
INSERT INTO salao_modulos (salao_id, modulo_chave, ativo, origem, ativado_em)
SELECT DISTINCT sm.salao_id, 'precificacao', true, 'migracao_chave', now()
FROM salao_modulos sm
JOIN modulos_catalogo mc ON mc.chave = sm.modulo_chave
WHERE sm.ativo = true
  AND sm.modulo_chave NOT IN ('fiscal','comunicacao','crescimento','precificacao','financeiro','relatorios','estoque','fidelidade')
  AND (mc.nome ILIKE '%precifica%' OR mc.nome ILIKE '%preço%' OR mc.nome ILIKE '%preci%' OR mc.nome ILIKE '%flow%' OR mc.nome ILIKE '%flex%')
ON CONFLICT (salao_id, modulo_chave) DO NOTHING;

-- ── Desativa todos os módulos antigos que não são os canônicos ───────────
UPDATE modulos_catalogo
SET ativo = false
WHERE chave NOT IN ('fiscal','comunicacao','crescimento','precificacao','financeiro','relatorios','estoque','fidelidade')
  AND chave NOT LIKE 'pacote_profissionais_%';

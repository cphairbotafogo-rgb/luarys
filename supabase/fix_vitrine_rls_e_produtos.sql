-- Fix: políticas de leitura pública da vitrine + acesso do portal aos produtos
-- Execute no SQL Editor do Supabase (yojtfrgoosapnsvyzgpw)

-- ─── 1. vitrine_config: garantir política pública de leitura ─────────────────
-- O portal (usuário autenticado sem auth_salao_id) precisa ler a config.
DROP POLICY IF EXISTS leitura_publica_vitrine_config ON vitrine_config;
CREATE POLICY leitura_publica_vitrine_config ON vitrine_config
  FOR SELECT TO anon, authenticated USING (true);

-- ─── 2. produtos: permitir leitura dos itens visíveis na vitrine ──────────────
-- Necessário para PortalVitrine renderizar os produtos no portal do cliente.
-- Só libera produtos marcados como visíveis (visivel_vitrine = true).
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS leitura_publica_produtos_vitrine ON produtos;
CREATE POLICY leitura_publica_produtos_vitrine ON produtos
  FOR SELECT TO anon, authenticated
  USING (visivel_vitrine = true);

-- Garantir que a policy do salão ainda exista (não perde acesso do admin)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'produtos' AND policyname = 'salao_gerencia_produtos'
  ) THEN
    EXECUTE 'CREATE POLICY salao_gerencia_produtos ON produtos
      USING (salao_id = auth_salao_id())
      WITH CHECK (salao_id = auth_salao_id())';
  END IF;
END $$;

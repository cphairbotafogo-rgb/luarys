-- Migration: Módulo Vitrine (Catálogo de Produtos + Promoções)
-- Execute no SQL Editor do Supabase (yojtfrgoosapnsvyzgpw)

-- ─── 1. Gate de licença na tabela saloes ─────────────────────────────────────
ALTER TABLE saloes
ADD COLUMN IF NOT EXISTS vitrine_liberada boolean NOT NULL DEFAULT false;

-- ─── 2. Tabela de promoções da vitrine ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS vitrine_promocoes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salao_id        uuid NOT NULL REFERENCES saloes(id) ON DELETE CASCADE,
  titulo          text NOT NULL,
  descricao       text,
  imagem_url      text,
  preco_original  numeric(10,2),
  preco_promo     numeric(10,2),
  validade_ate    date,
  ativo           boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ─── 3. RLS na tabela vitrine_promocoes ──────────────────────────────────────
ALTER TABLE vitrine_promocoes ENABLE ROW LEVEL SECURITY;

-- Salão lê/escreve apenas suas promoções
CREATE POLICY "salao_gerencia_promocoes"
ON vitrine_promocoes
USING (salao_id = auth_salao_id())
WITH CHECK (salao_id = auth_salao_id());

-- Leitura pública/portal (anon e authenticated) para promoções ativas
CREATE POLICY "leitura_publica_promocoes_ativas"
ON vitrine_promocoes FOR SELECT TO anon, authenticated
USING (ativo = true);

-- ─── 4. Trigger updated_at ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_vitrine_promocoes_updated_at ON vitrine_promocoes;
CREATE TRIGGER trg_vitrine_promocoes_updated_at
BEFORE UPDATE ON vitrine_promocoes
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── 5. vitrine_config: garantir tabela com colunas mínimas ──────────────────
-- (Cria caso não exista; se já existir, ignora)
CREATE TABLE IF NOT EXISTS vitrine_config (
  salao_id   uuid PRIMARY KEY REFERENCES saloes(id) ON DELETE CASCADE,
  modo       text NOT NULL DEFAULT 'catalogo'
               CHECK (modo IN ('desativada','catalogo','pedido','compra')),
  ativo      boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vitrine_config ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'vitrine_config' AND policyname = 'salao_gerencia_vitrine_config'
  ) THEN
    EXECUTE 'CREATE POLICY salao_gerencia_vitrine_config ON vitrine_config
      USING (salao_id = auth_salao_id())
      WITH CHECK (salao_id = auth_salao_id())';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'vitrine_config' AND policyname = 'leitura_publica_vitrine_config'
  ) THEN
    EXECUTE 'CREATE POLICY leitura_publica_vitrine_config ON vitrine_config
      FOR SELECT TO anon, authenticated USING (true)';
  END IF;
END $$;

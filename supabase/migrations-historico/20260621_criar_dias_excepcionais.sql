-- ============================================================
-- Cria a tabela dias_excepcionais (feriados e horários especiais)
-- Executar no SQL Editor do Supabase Dashboard
-- ============================================================

CREATE TABLE IF NOT EXISTS dias_excepcionais (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salao_id         UUID NOT NULL REFERENCES saloes(id) ON DELETE CASCADE,
  data             DATE NOT NULL,
  tipo             TEXT NOT NULL CHECK (tipo IN ('fechado', 'horario_especial')),
  hora_abertura    TIME,
  hora_fechamento  TIME,
  motivo           TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para acelerar busca por salão + data (usado em toda consulta do portal)
CREATE INDEX IF NOT EXISTS idx_dias_excepcionais_salao_data
  ON dias_excepcionais (salao_id, data);

-- Habilita RLS
ALTER TABLE dias_excepcionais ENABLE ROW LEVEL SECURITY;

-- Admin do salão: CRUD completo nas suas próprias datas
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'dias_excepcionais' AND policyname = 'admin_crud_dias_excepcionais'
  ) THEN
    CREATE POLICY "admin_crud_dias_excepcionais" ON dias_excepcionais
      FOR ALL TO authenticated
      USING (salao_id = auth_salao_id())
      WITH CHECK (salao_id = auth_salao_id());
  END IF;
END $$;

-- Portal: apenas leitura (para checar dias bloqueados na agenda)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'dias_excepcionais' AND policyname = 'portal_le_dias_excepcionais'
  ) THEN
    CREATE POLICY "portal_le_dias_excepcionais" ON dias_excepcionais
      FOR SELECT TO authenticated
      USING (true);
  END IF;
END $$;

-- ============================================================
-- Resultado esperado: CREATE TABLE + CREATE INDEX + 2× DO sem erro
-- ============================================================

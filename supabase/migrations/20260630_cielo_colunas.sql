-- Adiciona credenciais Cielo à tabela de contas de recebimento da plataforma.
-- MerchantId = clientId (identificador público do lojista)
-- MerchantKey = clientSecret (chave privada — tratar como senha)

ALTER TABLE plataforma_contas_recebimento
  ADD COLUMN IF NOT EXISTS cielo_merchant_id  TEXT,
  ADD COLUMN IF NOT EXISTS cielo_merchant_key TEXT;

-- Atualiza a constraint de gateway para aceitar 'cielo'
-- (se existir constraint CHECK no gateway, recriar; se não, ignorar)
DO $$
BEGIN
  ALTER TABLE plataforma_contas_recebimento
    DROP CONSTRAINT IF EXISTS plataforma_contas_recebimento_gateway_check;
EXCEPTION WHEN OTHERS THEN NULL;
END;$$;

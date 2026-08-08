-- Rastreia o número sequencial da NFC-e por salão (obrigatório pela SEFAZ)
ALTER TABLE configuracoes_nfce_produtos
  ADD COLUMN IF NOT EXISTS proximo_numero INT NOT NULL DEFAULT 1;

COMMENT ON COLUMN configuracoes_nfce_produtos.proximo_numero IS 'Próximo número a ser usado na emissão de NFC-e — incrementado a cada emissão';

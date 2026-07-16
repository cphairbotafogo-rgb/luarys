-- 20260707_nfce_modo_emissao.sql
--
-- Adiciona a "chave" de modo de emissão da NFC-e, espelhando o que a NFS-e já
-- tem (saloes.config_fiscal.modo_emissao). Aqui a config da NFC-e vive na
-- tabela própria configuracoes_nfce_produtos, então a coluna vai nela.
--
-- Valores: 'Automático' (emite ao finalizar a venda no Caixa) | 'Lote Manual'
-- (fica em rascunho para aprovação em NFC-e → Emitir Notas). Default seguro:
-- 'Lote Manual', para não emitir nota real sem o dono ligar de propósito.

ALTER TABLE configuracoes_nfce_produtos
  ADD COLUMN IF NOT EXISTS modo_emissao text NOT NULL DEFAULT 'Lote Manual';

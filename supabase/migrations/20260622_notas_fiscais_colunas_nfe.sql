-- Colunas necessárias para integração com Focus NFe (NFS-e)
ALTER TABLE notas_fiscais
  ADD COLUMN IF NOT EXISTS id_externo          TEXT,
  ADD COLUMN IF NOT EXISTS numero_nota         TEXT,
  ADD COLUMN IF NOT EXISTS chave_acesso        TEXT,
  ADD COLUMN IF NOT EXISTS link_pdf            TEXT,
  ADD COLUMN IF NOT EXISTS link_xml            TEXT,
  ADD COLUMN IF NOT EXISTS data_emissao        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS mensagem_erro       TEXT,
  ADD COLUMN IF NOT EXISTS cliente_cpf         TEXT,
  ADD COLUMN IF NOT EXISTS item_lista_servico  TEXT DEFAULT '06.01';

-- Status 'Cancelada' era inexistente — garante consistência
-- Os valores possíveis agora são:
--   'Não Emitido' | 'Pendente' | 'Emitida' | 'Erro' | 'Cancelada' | 'Isento'

COMMENT ON COLUMN notas_fiscais.id_externo IS 'UUID da nota no Focus NFe (referencia passada na requisição)';
COMMENT ON COLUMN notas_fiscais.numero_nota IS 'Número da nota emitida pela prefeitura';
COMMENT ON COLUMN notas_fiscais.link_pdf IS 'URL pública do PDF da NFS-e (retornada pelo Focus NFe)';
COMMENT ON COLUMN notas_fiscais.link_xml IS 'URL pública do XML da NFS-e (retornada pelo Focus NFe)';
COMMENT ON COLUMN notas_fiscais.item_lista_servico IS 'Código LC 116/2003 — padrão 06.01 para salões de beleza';

-- NFS-e/NFC-e via Brasil NFe (adaptadores reescritos contra o SDK real, Focus
-- NFe removido do sistema) precisam de:
--  1. Onde guardar o lote da NFS-e (a API da Brasil NFe consulta por lote,
--     não por uma referência livre como a Focus NFe aceitava).
--  2. Onde guardar o XML/PDF/DANFE — a Brasil NFe devolve em base64 no corpo
--     da resposta, não como link público (link_pdf/link_xml/link_danfe foram
--     desenhadas pra URL pública da Focus NFe). Os arquivos são baixados uma
--     vez e guardados no bucket privado `notas-fiscais`; o caminho (não uma
--     URL) fica salvo nessas colunas novas — a URL assinada é gerada sob
--     demanda por /api/nfse/arquivo/[notaId].

ALTER TABLE notas_fiscais
  ADD COLUMN IF NOT EXISTS cod_lote_brasilnfe TEXT,
  ADD COLUMN IF NOT EXISTS storage_path_xml   TEXT,
  ADD COLUMN IF NOT EXISTS storage_path_pdf   TEXT;

ALTER TABLE nfce_emissoes
  ADD COLUMN IF NOT EXISTS storage_path_xml   TEXT,
  ADD COLUMN IF NOT EXISTS storage_path_danfe TEXT;

-- Bucket privado criado via migration (em vez de depender de criação manual
-- no dashboard do Supabase — foi exatamente um bucket faltante desse jeito
-- que causou o bug do upload de certificado A1 antes desta correção).
INSERT INTO storage.buckets (id, name, public)
VALUES ('notas-fiscais', 'notas-fiscais', false)
ON CONFLICT (id) DO NOTHING;

-- Sem policy de leitura direta pro client: todo acesso ao bucket passa por
-- rota de API com service_role (/api/nfse/arquivo/[notaId]), que confere
-- posse da nota antes de gerar a signed URL — não precisa de RLS em
-- storage.objects pra isso.

-- 20260804c_subprocessador_brasilnfe.sql
--
-- Troca o subprocessador de documentos fiscais nos textos legais publicados:
-- Tecnospeed / Focus NFe  →  Brasil NFe Ltda.
--
-- CONTEXTO: o Luarys deixou de usar a Focus NFe — a emissão de NFS-e e NFC-e
-- passou a ser feita exclusivamente pela Brasil NFe. Manter a Focus listada
-- como suboperadora, e a Brasil NFe fora da lista, deixava a Política de
-- Privacidade e o CTD/DPA descrevendo um tratamento de dados que não existe
-- mais e omitindo o que existe.
--
-- POR QUE UMA MIGRATION E NÃO SÓ O CÓDIGO: as páginas /privacidade, /dpa e
-- /termos renderizam o conteúdo de `plataforma_documentos` quando há registro
-- ativo; o JSX das páginas é apenas fallback para quando a tabela está vazia.
-- Alterar só o código não mudaria o que o usuário lê no site.
--
-- Faz o replace nas duas grafias que existiam (a Política usava
-- "Tecnospeed S.A. (Focus NFe)" e o DPA "Tecnospeed S.A. / Focus NFe") e é
-- idempotente: rodar de novo não encontra mais nada para trocar.
--
-- ⚠️ OBRIGAÇÃO CONTRATUAL: tanto o DPA quanto a Política preveem aviso prévio
-- de 30 dias ao Controlador para mudança na lista de suboperadores. Esta
-- migration altera o texto; a COMUNICAÇÃO aos salões é um passo à parte e
-- precisa ser feita pelo Ari.

UPDATE plataforma_documentos
   SET conteudo = replace(
                    replace(
                      conteudo,
                      '<strong>Tecnospeed S.A. (Focus NFe)</strong>',
                      '<strong>Brasil NFe Ltda.</strong>'
                    ),
                    '<strong>Tecnospeed S.A. / Focus NFe</strong>',
                    '<strong>Brasil NFe Ltda.</strong>'
                  ),
       atualizado_em = NOW()
 WHERE conteudo LIKE '%Tecnospeed%';

-- Conferência: deve retornar 0 linhas depois de aplicar.
-- SELECT tipo, versao FROM plataforma_documentos WHERE conteudo LIKE '%Tecnospeed%' OR conteudo LIKE '%Focus NFe%';

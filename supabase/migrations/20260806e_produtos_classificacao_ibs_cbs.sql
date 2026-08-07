-- Classificação tributária do IBS/CBS por produto (Reforma Tributária).
--
-- A SEFAZ-RJ avisou em 09/07/2026: "A partir de 03 de agosto, documentos fiscais
-- eletrônicos sem as informações de IBS e CBS serão rejeitados." Vale para os
-- documentos ESTADUAIS — NF-e, NFC-e, CT-e. A NFS-e é municipal e não entra
-- neste aviso.
--
-- Como a NFC-e do Luarys nunca emitiu (serviço desativado no provedor), isso
-- ainda não quebrou nada. Quebraria na primeira venda de produto depois de
-- ativada: o payload manda ICMS, PIS e COFINS e não manda IBSCBS.
--
-- O `cClassTrib` (Código de Classificação Tributária) depende do que a
-- mercadoria é e de qual anexo/benefício se aplica — cosmético não é alimento
-- nem medicamento. Quem responde por isso é a contabilidade do salão, não o
-- Luarys. Por isso a coluna é NULÁVEL: em branco, a emissão usa o padrão
-- documentado pelo provedor ("000001") e a tela avisa que o código deve ser
-- confirmado. Não se inventa código fiscal — foi assim que nasceu a rejeição
-- E0314 na NFS-e.

ALTER TABLE produtos
  ADD COLUMN IF NOT EXISTS cclasstrib TEXT;

COMMENT ON COLUMN produtos.cclasstrib IS
  'Código de Classificação Tributária do IBS/CBS (Reforma Tributária). Nulo = usa o padrão 000001 do provedor. Confirmar com a contabilidade.';

-- 20260708_assinatura_profissionais_area.sql
--
-- A assinatura fica PRESA a um profissional por área (categoria dos serviços
-- inclusos), escolhido na criação e NÃO transferível. Só esse profissional
-- executa os inclusos daquela área; se outro fizer, é serviço normal.
--
-- profissionais_area: [{ categoria, profissional_id, profissional_nome }]

ALTER TABLE assinaturas_cliente
  ADD COLUMN IF NOT EXISTS profissionais_area jsonb NOT NULL DEFAULT '[]';

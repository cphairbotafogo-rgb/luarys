-- 20260717_saloes_prazo_sinal_minutos.sql
--
-- Adiciona coluna prazo_sinal_minutos à tabela saloes.
-- Usada pelo Portal do Cliente para controlar o tempo limite que o cliente
-- tem para pagar o sinal de reserva antes do agendamento ser cancelado.
-- Padrão: 20 minutos.

ALTER TABLE saloes
  ADD COLUMN IF NOT EXISTS prazo_sinal_minutos integer NOT NULL DEFAULT 20;

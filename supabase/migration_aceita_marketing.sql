-- Migration: opt-out de marketing controlado pelo cliente
-- Execute no SQL Editor do Supabase (yojtfrgoosapnsvyzgpw)

ALTER TABLE clientes
ADD COLUMN IF NOT EXISTS aceita_marketing boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN clientes.aceita_marketing IS
  'Preferência de marketing do próprio cliente (opt-out). '
  'true = aceita promoções/campanhas. false = recusa. '
  'Lembretes de agendamento ignoram este campo.';

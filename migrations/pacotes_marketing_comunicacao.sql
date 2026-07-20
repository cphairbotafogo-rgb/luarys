-- Insere os 4 pacotes de créditos de marketing no Módulo Comunicação.
-- Execute UMA VEZ no Supabase SQL Editor (Dashboard → SQL Editor → New Query).
-- Se os pacotes já existirem (mesmo tipo + quantidade), não duplica.

INSERT INTO whatsapp_pacotes (tipo, quantidade, preco, ativo)
VALUES
  ('campanha', 100,  55.00,  true),
  ('campanha', 200, 110.00,  true),
  ('campanha', 300, 165.00,  true),
  ('campanha', 500, 275.00,  true)
ON CONFLICT DO NOTHING;

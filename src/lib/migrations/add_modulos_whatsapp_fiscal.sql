-- Migration: Adicionar módulos comerciais ao catálogo
-- Rodar no Supabase → SQL Editor

INSERT INTO modulos_catalogo (chave, nome, descricao, preco_mensal, ativo)
VALUES
  (
    'pacote_whatsapp',
    'WhatsApp Business',
    'Envio automático de mensagens via API oficial do WhatsApp (Meta). Confirmação de agendamento, aniversários e recuperação de clientes inativos. Sem QR Code, sem risco de banimento.',
    99.90,
    true
  ),
  (
    'pacote_fiscal',
    'Módulo Fiscal (NFS-e / NFC-e)',
    'Emissão de Notas Fiscais de Serviço (NFS-e) e Cupom Fiscal Eletrônico (NFC-e) via Focus NFe, homologado em todos os estados brasileiros. Inclui até 500 documentos/mês.',
    79.90,
    true
  )
ON CONFLICT (chave) DO NOTHING;

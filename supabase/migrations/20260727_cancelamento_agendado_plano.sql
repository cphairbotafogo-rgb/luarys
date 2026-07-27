-- Cancelamento do PLANO BASE (Essencial/Growth/Escala) — até agora só os
-- módulos adicionais tinham essa opção (salao_modulos.cancelamento_agendado).
-- Mesma semântica: marca a intenção de cancelar, mas o acesso continua até o
-- fim do período já pago (plano_renovacao_em) — só nesse momento, o cron
-- processar-vencimentos suspende de fato.
alter table saloes
  add column if not exists cancelamento_agendado boolean not null default false;

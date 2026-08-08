-- Garante que apenas UMA conta de recebimento pode estar ativa por vez.
-- Trigger desativa todas as outras ao ativar uma nova.

CREATE OR REPLACE FUNCTION desativar_outras_contas_recebimento()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.ativa = TRUE THEN
    UPDATE plataforma_contas_recebimento
    SET ativa = FALSE
    WHERE id <> NEW.id AND ativa = TRUE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trig_gateway_unico_ativo ON plataforma_contas_recebimento;

CREATE TRIGGER trig_gateway_unico_ativo
BEFORE INSERT OR UPDATE OF ativa ON plataforma_contas_recebimento
FOR EACH ROW EXECUTE FUNCTION desativar_outras_contas_recebimento();

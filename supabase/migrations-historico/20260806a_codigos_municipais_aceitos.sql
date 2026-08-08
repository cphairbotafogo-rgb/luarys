-- Conhecimento da plataforma sobre qual código de tributação municipal cada
-- município aceita para cada código nacional.
--
-- Por que existe: o código nacional (cTribNac) é da lista da LC 116 e vale no
-- Brasil inteiro. O municipal (cTribMun) é o desdobro que CADA prefeitura criou,
-- com formato próprio — o Rio usa '005' para salão-parceiro do Simples, e nada
-- garante que outro município use três dígitos, muito menos esse valor.
--
-- Não existe fonte para consultar isso: a API de parâmetros municipais do
-- Ambiente Nacional exige mTLS com certificado ICP-Brasil, que o Luarys não
-- guarda por decisão de projeto, e a Brasil NFe não expõe consulta equivalente
-- (verificado na documentação em 06/08/2026). Sobra uma fonte, que só a
-- plataforma tem: o que a prefeitura de fato aceitou.
--
-- A tabela é da plataforma, não do salão. Guarda só código fiscal — nenhum CNPJ,
-- nome de cliente ou valor. O que um salão de Curitiba descobre serve para o
-- próximo salão de Curitiba.

CREATE TABLE IF NOT EXISTS codigos_municipais_aceitos (
  codigo_ibge    TEXT     NOT NULL,
  ctrib_nac      TEXT     NOT NULL,
  ctrib_mun      TEXT     NOT NULL,
  -- 1 produção, 2 homologação. Aceite em produção vale mais que em teste.
  ambiente       SMALLINT NOT NULL DEFAULT 2,
  aceitos        INTEGER  NOT NULL DEFAULT 0,
  recusados      INTEGER  NOT NULL DEFAULT 0,
  ultimo_erro    TEXT,
  primeira_vez   TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (codigo_ibge, ctrib_nac, ctrib_mun, ambiente)
);

COMMENT ON TABLE codigos_municipais_aceitos IS
  'O que cada prefeitura aceitou como cTribMun. Alimentada pela emissão; sugere código no cadastro de serviço. Sem dado de cliente.';
COMMENT ON COLUMN codigos_municipais_aceitos.recusados IS
  'Rejeições (E0314 e afins). Código recusado deixa de ser sugerido mesmo que já tenha sido aceito antes — prefeitura muda tabela.';

ALTER TABLE codigos_municipais_aceitos ENABLE ROW LEVEL SECURITY;

-- Leitura liberada para usuário autenticado: são códigos fiscais públicos, e a
-- sugestão precisa chegar na tela de cadastro de serviço de qualquer salão.
-- Escrita só por service_role (a rota de emissão), que ignora RLS.
DROP POLICY IF EXISTS codigos_municipais_leitura ON codigos_municipais_aceitos;
CREATE POLICY codigos_municipais_leitura ON codigos_municipais_aceitos
  FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_codmun_busca
  ON codigos_municipais_aceitos (codigo_ibge, ctrib_nac, ambiente);

-- Semente do que já sabemos por evidência direta: cinco NFS-e de produção do
-- Rio (notas 613, 626, 635, 642 e 644 do CNPJ 17.326.293/0001-02) mostram
-- 060101 / 005. Entra como produção porque veio de nota real autorizada.
INSERT INTO codigos_municipais_aceitos (codigo_ibge, ctrib_nac, ctrib_mun, ambiente, aceitos)
VALUES ('3304557', '060101', '005', 1, 5)
ON CONFLICT (codigo_ibge, ctrib_nac, ctrib_mun, ambiente) DO NOTHING;

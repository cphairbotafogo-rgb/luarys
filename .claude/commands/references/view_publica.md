# View pública — quando a tabela mistura dado sensível e dado público

## Quando usar

Uma tabela precisa de policy `anon`/pública (ex: `servicos`, para o Portal
mostrar preço e duração), mas tem colunas que nunca deveriam vazar (ex:
`custo_operacional`, `comissao_padrao`). RLS do Postgres filtra **linhas**,
não **colunas** — não dá para dizer "essa policy libera só essas 3
colunas". A solução é uma view com só as colunas seguras, e apontar o
client público para a view em vez da tabela.

## Exemplo: `servicos`

```sql
-- 1. Cria a view só com colunas seguras para exposição pública
CREATE OR REPLACE VIEW servicos_publico AS
SELECT
  id,
  salao_id,
  nome_servico,
  descricao,
  preco_padrao,
  tipo_preco,
  duracao_minutos,
  categoria,
  setor,
  exibir_online
FROM servicos
WHERE exibir_online = true;
-- NUNCA inclua aqui: custo_operacional, comissao_padrao, tipo_despesa,
-- valor_despesa, nbs, codigo_municipio, aliquota_iss (tributação
-- também é informação interna, não deveria ser pública)

-- 2. Permissão de leitura na view (views não usam RLS da tabela base
-- diretamente — security_invoker controla isso; testar no Supabase)
GRANT SELECT ON servicos_publico TO anon, authenticated;

-- 3. Revoga acesso público direto à tabela original, se ainda não foi feito
DROP POLICY IF EXISTS "servicos_select_publico" ON servicos;
-- a tabela `servicos` real só fica acessível para `authenticated` com
-- salao_id = auth_salao_id(), como qualquer outra tabela operacional
```

## No frontend

Trocar a fonte de dado do Portal de `servicos` para `servicos_publico`:

```ts
// Antes (expõe custo_operacional/comissao_padrao sem querer)
const { data } = await supabase.from('servicos').select('*').eq('salao_id', salaoId);

// Depois (só as colunas seguras)
const { data } = await supabase.from('servicos_publico').select('*').eq('salao_id', salaoId);
```

Telas internas do sistema principal (`ModalServicos.tsx`, `AbaPrecificacao.tsx`
etc.) continuam usando a tabela `servicos` completa normalmente — só o
Portal (e qualquer outro consumidor sem login) deve usar a view.

## Checklist ao criar uma view pública nova

1. Listar explicitamente as colunas incluídas (nunca `SELECT *` numa view pública)
2. Revisar cada coluna perguntando "isso pode aparecer pra um concorrente
   sem login?" — se a resposta for não, não inclui
3. Conferir se a tabela base tem RLS que bloqueia acesso direto de `anon`
   (a view não substitui isso — ela é uma porta alternativa mais estreita,
   a porta larga original ainda precisa estar fechada)
4. Atualizar o frontend público para consumir a view, não a tabela base

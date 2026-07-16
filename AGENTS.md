<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Arquitetura do Sistema — consulte antes de criar qualquer feature

Antes de criar nova aba, modal, gaveta, hook ou qualquer feature que envolva mais de 1 arquivo:

1. Use a skill `/luarys-arquitetura` (ou leia `.claude/commands/luarys-arquitetura.md`)
2. O mapa mostra onde criar o arquivo, o que mais precisa ser atualizado e os cross-imports críticos

**Erros reais que já ocorreram por não checar:**
- Modal criado mas pasta interna ficou vazia (fechamento/ sem arquivos) → build error
- Componente duplicado em vez de importado do módulo original (GavetaCadastroCliente)
- Aba criada mas não registrada na sidebar ou em page.tsx → aba invisível
- `borderRadius: 8` hardcoded em vez de `RAIO_MD` → inconsistência visual

# Banco de Dados Supabase — consulte antes de escrever queries

Antes de escrever qualquer query Supabase com colunas explícitas (`.select('coluna')`, `.insert({coluna})`, `.eq('coluna', ...)`) ou antes de criar uma tabela nova:

1. Use a skill `/luarys-banco-dados` (ou leia `.claude/commands/luarys-banco-dados.md`)
2. O schema completo está em `.claude/commands/references/schema-banco.md`

**Erros reais que já ocorreram por não checar:**
- `agendamentos.id_prof` não existe → nome real é `profissional_id`
- `agendamentos.servico` não existe → nome vem de JOIN com `servicos.nome_servico`
- `servicos.duracao_min` não existe → nome real é `duracao_minutos`
- `clientes.telefone` não existe → nome real é `telefone_whatsapp`

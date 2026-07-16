---
name: luarys-arquitetura
description: Mapa completo da arquitetura do sistema Luarys/Eleva — onde ficam os arquivos, como se conectam, e o que atualizar quando uma feature nova é adicionada. USE antes de criar nova aba, modal, gaveta, hook, ou qualquer feature que envolva mais de 1 arquivo. Previne erros de pasta errada, importação esquecida, e falta de conexão entre módulos.
---

# Arquitetura do Sistema Luarys/Eleva

Leia esta página **inteira** antes de criar qualquer feature nova. Cada seção tem um checklist específico que evita os erros mais comuns: arquivo criado mas não importado, aba registrada mas sem entrada na sidebar, modal sem estilos corretos, cross-import de lugar errado.

---

## Mapa de Pastas (o que vai onde)

```
src/
├── app/
│   ├── page.tsx              ← CENTRO DO SISTEMA: renderiza toda aba por condicional
│   ├── layout.tsx
│   ├── api/                  ← Rotas de API Next.js (webhooks, NFS-e, pagamentos)
│   │   ├── nfce/, nfse/      ← Integração Focus NFe
│   │   ├── pagamentos/       ← Webhooks de gateway
│   │   └── admin/
│   ├── portal/               ← Portal do cliente (fluxo separado do app principal)
│   └── admin/                ← Painel admin da plataforma (gestão de salões)
│
├── modules/                  ← MÓDULOS DE NEGÓCIO — 1 pasta por domínio
│   ├── agenda/
│   │   ├── AbaAgenda.tsx     ← aba principal
│   │   ├── AgendaHeader.tsx  ← componente auxiliar (dentro da pasta do módulo)
│   │   ├── AgendaGrid.tsx
│   │   ├── AgendaSidebar.tsx
│   │   └── modals/
│   │       ├── hooks/        ← hooks só usados pelos modais desta aba
│   │       └── fechamento/   ← sub-componentes de um modal específico
│   ├── relatorios/
│   │   ├── AbaRelatorios.tsx
│   │   ├── gavetas/          ← cada relatório é uma gaveta separada
│   │   └── hooks/            ← hooks de relatório (useCapacidade, useAtendimentos...)
│   ├── crm/, caixa/, financeiro/, equipe/, estoque/, servicos/
│   ├── configuracoes/        ← settings do salão (inclui AbaComunicacao, AbaConfigTaxas…)
│   ├── crescimento/, precificacao/
│   └── [nome_modulo]/
│       ├── Aba[NomeModulo].tsx   ← arquivo de entrada
│       ├── modals/               ← modais da aba (opcional)
│       ├── hooks/                ← hooks locais (opcional)
│       └── gavetas/              ← sub-views (opcional, comum em relatórios e estoque)
│
├── components/               ← Componentes compartilhados entre módulos
│   ├── Sidebar.tsx           ← importa catalogoItensSidebar
│   ├── Header.tsx
│   ├── Toast.tsx             ← sistema global de notificações
│   └── sidebar/
│       ├── catalogoItensSidebar.tsx  ← REGISTRO DE TODAS AS ABAS (menu lateral)
│       ├── montarItensVisiveis.ts
│       └── usePreferenciasSidebar.ts
│
└── lib/                      ← Utilitários e constantes globais
    ├── constants.ts           ← paleta C.* e função brl()
    ├── estiloGlobal.ts        ← RAIO_*, sombras, overlayModal, containerModal
    ├── permissoes.ts          ← temPermissao(), CATALOGO_PERMISSOES, PERFIS_BASE
    ├── agendaUtils.ts
    └── supabase.ts            ← cliente Supabase (importar de @/lib/supabase)
```

---

## Padrões de Nomenclatura

| O que criar | Padrão de nome | Localização |
|---|---|---|
| Aba principal | `Aba[Nome].tsx` | `src/modules/[dominio]/` |
| Modal | `Modal[Acao].tsx` | `src/modules/[dominio]/modals/` |
| Gaveta de relatório | `Gaveta[Tipo].tsx` | `src/modules/relatorios/gavetas/` |
| Hook de módulo | `use[Funcao].ts` | `src/modules/[dominio]/hooks/` |
| Hook de modal | `use[Funcao].ts` | `src/modules/[dominio]/modals/hooks/` |
| Sub-componente de modal | `[Funcao][Painel\|UI].tsx` | `src/modules/[dominio]/modals/[subpasta]/` |
| Componente auxiliar de aba | `[Nome]Header/Grid/Sidebar.tsx` | Junto com a aba, mesma pasta |

---

## Onde Fica Cada Aba (Renderização em `page.tsx`)

O `src/app/page.tsx` é o maestro. Toda aba é renderizada lá por condicional. As linhas aproximadas:

| Aba | Chave string | Linha aprox. em page.tsx |
|---|---|---|
| Dashboard | `"dashboard"` | ~264 |
| Agenda | `"agenda"` | ~267 |
| CRM | `"crm"` | ~283 |
| Comunicação | `"comunicacao"` | ~285 |
| Relatórios | `"relatorios"` | ~265 |
| Financeiro | `"financeiro"` | ~289 |
| Estoque | `"estoque"` | ~290 |
| Serviços | `"servicos"` | ~292 |
| Equipe | `"equipe"` | ~291 |
| Configurações | `"configuracoes"` | ~293 |
| NFSe | `"nfse"` | ~269 |
| NFCe | `"nfce"` | ~270 |
| Precificação | `"precificacao"` | ~277 |
| Crescimento | `"crescimento"` | ~278 |

---

## CHECKLIST: Nova Aba

Quando criar uma aba nova, atualizar em **3 lugares obrigatórios**:

### 1. Criar o arquivo da aba
```typescript
// src/modules/[dominio]/Aba[Nome].tsx
'use client'
export function Aba[Nome]({ perfil }: any) {
  return <div>...</div>;
}
```

### 2. Registrar em `src/app/page.tsx` (3 pontos dentro do mesmo arquivo)
```typescript
// Ponto A — imports no topo (~linha 13-34):
import { AbaNovoModulo } from "@/modules/novo_modulo/AbaNovoModulo";

// Ponto B — abasValidas (~linha 206):
const abasValidas = ["dashboard", "agenda", ..., "novo_modulo"];

// Ponto C — titles (~linha 221):
const titles: any = { "novo_modulo": "Nome Visível", ... };

// Ponto D — renderAba (~linha 263-294):
if (aba === "novo_modulo") return <AbaNovoModulo perfil={perfil} />;
```

### 3. Registrar em `src/components/sidebar/catalogoItensSidebar.tsx`
```typescript
{
  id: 'novo_modulo',
  label: 'Nome Visível no Menu',
  icon: <FiIcone size={18} />,
  secao: 'Operação',  // ou 'Gestão & Negócio' ou 'Fiscal & Ajustes'
  condicao: (perfil: any) => perfil?.isDono || temPermissao(perfil, 'modulo.novo_modulo'),
},
```

### 4. Se a aba tiver permissão própria — `src/lib/permissoes.ts`
```typescript
// CATALOGO_PERMISSOES (~linha 36):
{ chave: 'modulo.novo_modulo', categoria: 'modulo', rotulo: 'Acessar Novo Módulo', descricao: '...' },

// PERFIS_BASE (opcional — adicionar ao perfil Gerente se necessário, ~linha 106):
permissoes: { 'modulo.novo_modulo': true, ... }
```

---

## CHECKLIST: Nova Gaveta de Relatório

Quando criar uma nova gaveta (relatório), atualizar em **4 lugares**:

### 1. Criar o arquivo da gaveta
```typescript
// src/modules/relatorios/gavetas/Gaveta[Nome].tsx
export function Gaveta[Nome]({ dados, perfil }: any) {
  const { financeiro, agendamentos, clientes } = dados;
  return <div>...</div>;
}
```

### 2. Importar em `src/modules/relatorios/AbaRelatorios.tsx`
```typescript
import { GavetaNome } from "./gavetas/GavetaNome";
```

### 3. Adicionar ao mapa de nomes (~linha 86)
```typescript
const nomesRelatorios: any = {
  'nome': 'Título do Relatório',
  ...
};
```

### 4. Adicionar botão no menu lateral + renderização dinâmica
```typescript
// Menu (~linha 118-180):
<button style={menuBtnStyle(relatorioAtivo === 'nome')}
  onClick={() => setRelatorioAtivo('nome')}>
  <FiIcone size={16} /> Título
</button>

// Render (~linha 206-221):
{relatorioAtivo === 'nome' && <GavetaNome dados={dadosBase} perfil={perfil} />}
```

---

## CHECKLIST: Novo Modal

### Estrutura obrigatória
```typescript
// src/modules/[dominio]/modals/Modal[Nome].tsx
'use client'
import { overlayModal, containerModal } from "@/lib/estiloGlobal";
import { C } from "@/lib/constants";
import { FiX } from "react-icons/fi";
import { toast } from "@/components/Toast";

export function Modal[Nome]({ perfil, onClose, aoSalvar }: any) {
  return (
    <div style={{ ...overlayModal }}>
      <div style={{ ...containerModal, padding: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
          <h2>Título do Modal</h2>
          <button onClick={onClose}><FiX size={20} /></button>
        </div>
        {/* conteúdo */}
        <button onClick={async () => {
          await salvar();
          toast.sucesso('Salvo com sucesso!');
          aoSalvar?.();  // recarregar dados no pai
          onClose();
        }}>Salvar</button>
      </div>
    </div>
  );
}
```

### Como abrir o modal no Pai
```typescript
// No componente pai (Aba, outra Modal, etc.):
const [modalAberto, setModalAberto] = useState(false);
const [itemEditando, setItemEditando] = useState<any>(null);

// trigger:
<button onClick={() => { setItemEditando(item); setModalAberto(true); }}>Editar</button>

// render (FORA do return principal, mas dentro do componente):
{modalAberto && (
  <ModalNome
    perfil={perfil}
    item={itemEditando}
    onClose={() => setModalAberto(false)}
    aoSalvar={() => carregarDados()}  // ← SEMPRE recarregar após salvar
  />
)}
```

**Tamanhos de modal disponíveis em `estiloGlobal`:**
- `containerModal` — padrão, max-width 600px
- `containerModalPerigo` — borda vermelha, para ações destrutivas
- Para modais grandes (ex: fechamento de caixa), não usar containerModal — criar div própria com `maxWidth: 1050`

---

## CHECKLIST: Novo Hook

```typescript
// src/modules/[dominio]/hooks/use[Nome].ts
'use client'  // apenas se usar useState/useEffect
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export function use[Nome]({ perfil, ...outros }: any) {
  const [dados, setDados] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(false);

  async function carregar() {
    setCarregando(true);
    const { data } = await supabase
      .from('tabela')
      .select('coluna_real')  // ← checar schema-banco.md ANTES
      .eq('salao_id', perfil.salao_id);
    setDados(data || []);
    setCarregando(false);
  }

  useEffect(() => { carregar(); }, [perfil.salao_id]);

  return { dados, carregando, carregar };
}
```

**Importar o hook:** sempre via importação relativa ou `@/modules/`.
Nunca duplicar um hook que já existe em outro módulo — verificar se o hook que você precisa já existe.

---

## Cross-Imports Críticos (o que é compartilhado entre módulos)

Estes componentes/hooks são usados por **mais de um módulo**. Nunca duplicar — importar do local original:

| O que | Local original | Usado por |
|---|---|---|
| `GavetaCadastroCliente` | `@/modules/crm/GavetaCadastroCliente` | agenda + crm |
| `ModalNovaDespesa` | `@/modules/financeiro/modals/ModalNovaDespesa` | financeiro + relatorios |
| `Toast / toast` | `@/components/Toast` | tudo — notificações globais |
| `temPermissao` | `@/lib/permissoes` | tudo — checagem de acesso |
| `C` (cores) | `@/lib/constants` | tudo — paleta de cores |
| `brl` | `@/lib/constants` | tudo — formatação de moeda |
| `RAIO_*, overlayModal, containerModal` | `@/lib/estiloGlobal` | tudo — estilos |
| `supabase` (client) | `@/lib/supabase` | tudo — queries |
| `ConfigComunicados, ConfigVitrine` | `@/modules/portal/` | apenas configuracoes |

---

## Fluxo de Estado Global

```
page.tsx (Maestro)
  │
  ├─ perfil  ──────────────────────────────── passado como prop para TODA aba
  │    │                                       tipo: { id, nome, salao_id, isDono,
  │    │                                         moduloFiscalLiberado,
  │    │                                         permissoes: { 'chave': true } }
  │    │
  │    └─ READ-ONLY — nunca modificar perfil
  │         para salvar algo: usar route API ou função Supabase
  │
  └─ aba (string)  ────────────────────────── qual aba está visível
       hash-driven: #agenda → aba = "agenda"
       muda via: setAba('agenda') ou window.location.hash = '#agenda'
```

**Regras de estado:**
- Estado de UI (modal aberto, item selecionado, filtro) → `useState` local na aba/modal
- Dados do banco → `useEffect + supabase` dentro do componente ou em hook dedicado
- `perfil` → nunca é alterado localmente; vem do Supabase `auth.getUser()` + query `perfis_usuarios`
- Recarregar dados após salvar → chamar a função `carregar()` do hook, ou usar callback `aoSalvar`

---

## Estilos Globais — O que NUNCA fazer

```typescript
// ❌ NUNCA hardcode de cores, raios ou sombras:
style={{ borderRadius: 8, color: "#2C3643", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}

// ✅ SEMPRE usar as constantes:
import { C, brl } from "@/lib/constants";
import { RAIO_MD, RAIO_2XL, SOMBRA_CARD } from "@/lib/estiloGlobal";
style={{ borderRadius: RAIO_MD, color: C.textMain, boxShadow: SOMBRA_CARD }}

// ❌ NUNCA criar overlay de modal do zero:
style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000 }}

// ✅ SEMPRE usar o padrão do projeto:
import { overlayModal, containerModal } from "@/lib/estiloGlobal";
<div style={{ ...overlayModal }}><div style={{ ...containerModal }}>{...}</div></div>

// ❌ NUNCA formatar moeda manualmente:
`R$ ${valor.toFixed(2)}`

// ✅ SEMPRE:
brl(valor)  // retorna "R$ 1.234,56" no padrão pt-BR

// ❌ NUNCA usar ícones de bibliotecas diferentes sem verificar o padrão:
// O projeto usa EXCLUSIVAMENTE react-icons/fi (Feather Icons)
import { FiCheck, FiX, FiPlus, FiTrash2 } from "react-icons/fi";
```

---

## Sistema de Permissões

```typescript
import { temPermissao } from "@/lib/permissoes";

// Verificar antes de renderizar:
if (!temPermissao(perfil, 'modulo.financeiro')) return null;

// Verificar antes de executar ação:
if (!temPermissao(perfil, 'financeiro.criar_lancamento')) {
  toast.aviso('Sem permissão para esta ação.');
  return;
}

// Donos do salão têm acesso total — verificar isDono antes de bloquear:
if (!perfil.isDono && !temPermissao(perfil, 'chave')) { ... }
```

**Módulos premium (requerem `isDono` ou flag específica):**
- NFSe, NFCe → `perfil.moduloFiscalLiberado`
- Comunicação (WhatsApp) → `perfil.moduloComunicacaoLiberado`
- Crescimento, Precificação → `perfil.isDono`

---

## Armadilhas Frequentes (Erros Reais que Já Aconteceram)

| Situação | ❌ O que foi feito errado | ✅ O que fazer |
|---|---|---|
| Nova aba criada | Arquivo criado, mas não adicionado à sidebar | Sempre atualizar os 3 lugares: page.tsx + catalogoItensSidebar |
| Modal criado | Pasta nova criada mas arquivos dentro nunca foram escritos | Verificar que os arquivos exportados pelo index existem de fato |
| Cross-import | Componente duplicado em vez de importado do módulo original | Sempre verificar se já existe em outro módulo antes de criar |
| Estilos | `borderRadius: 8` direto no style | Usar `RAIO_MD` de estiloGlobal |
| Notificação | `alert()` ou `console.log` para feedback ao usuário | Usar `toast.sucesso()`, `toast.erro()`, `toast.aviso()` |
| Recarregar após salvar | Modal fecha mas dados da tela não atualizam | Sempre chamar `carregar()` ou `aoSalvar?.()` no callback do modal |
| Banco de dados | Usar nome de coluna que parece óbvio | Checar `references/schema-banco.md` antes de qualquer query |

---

## Referência Rápida de Importações Mais Usadas

```typescript
// Estilos e cores
import { C, brl } from "@/lib/constants";
import { RAIO_SM, RAIO_MD, RAIO_LG, RAIO_XL, RAIO_2XL, SOMBRA_CARD, overlayModal, containerModal, botaoPrimario } from "@/lib/estiloGlobal";

// Ícones (APENAS react-icons/fi)
import { FiX, FiPlus, FiTrash2, FiCheck, FiEdit2, FiSearch, FiFilter } from "react-icons/fi";

// Banco
import { supabase } from "@/lib/supabase";

// Notificações
import { toast } from "@/components/Toast";

// Permissões
import { temPermissao } from "@/lib/permissoes";

// Componentes globais reutilizáveis
import { GavetaCadastroCliente } from "@/modules/crm/GavetaCadastroCliente";
import { ModalNovaDespesa } from "@/modules/financeiro/modals/ModalNovaDespesa";
```

---

## Quando Usar Esta Skill vs Outras

| Pergunta | Skill a usar |
|---|---|
| "Qual coluna do banco usar?" | `/luarys-banco-dados` |
| "Onde criar o arquivo? O que mais precisa ser atualizado?" | Esta skill (`/luarys-arquitetura`) |
| "Como checar segurança e RLS?" | `/eleva-seguranca-dados` |
| "Devo criar nova tabela, qual o padrão?" | `/luarys-banco-dados` + verificar seção de convenções |

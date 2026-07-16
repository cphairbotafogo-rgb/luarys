'use client'

import { useState } from 'react';
import { C } from '@/lib/constants';
import { RAIO_XL, RAIO_XS } from '@/lib/estiloGlobal';
import { temPermissao } from '@/lib/permissoes';
import {
  FiDollarSign, FiRepeat, FiCreditCard, FiTag, FiUser,
  FiPercent, FiBarChart2, FiClock, FiSlash,
  FiUsers, FiGift, FiAlertCircle, FiPackage,
  FiList, FiAward, FiThermometer, FiGrid,
  FiFileText, FiXCircle, FiAlertTriangle, FiRefreshCw, FiBook,
  FiTarget,
} from 'react-icons/fi';

// ─── TIPOS ───────────────────────────────────────────────────────────────────

type Categoria = 'Todos' | 'Financeiro' | 'Equipe' | 'Clientes' | 'Operacional' | 'Auditoria';

interface ItemRelatorio {
  id: string;
  nome: string;
  descricao: string;
  categoria: Categoria;
  icone: React.ReactNode;
}

// ─── CORES DE BADGE POR CATEGORIA ────────────────────────────────────────────

const COR_BADGE: Record<string, { bg: string; cor: string }> = {
  Financeiro:   { bg: '#D1FAE5', cor: C.success },
  Equipe:       { bg: '#E2E8EF', cor: C.sidebarBg },
  Clientes:     { bg: '#FDF8E7', cor: C.douradoEleva },
  Operacional:  { bg: '#FEF9C3', cor: C.warning },
  Auditoria:    { bg: '#FEE2E2', cor: C.danger },
};

// ─── CATÁLOGO DE RELATÓRIOS ───────────────────────────────────────────────────

const RELATORIOS: ItemRelatorio[] = [
  // Financeiro
  { id: 'balanco',          nome: 'Balanço de Resultados (DRE)',       descricao: 'Receitas, despesas e resultado líquido por mês',                  categoria: 'Financeiro',  icone: <FiDollarSign size={20} />  },
  { id: 'movimentacoes',    nome: 'Movimentações Financeiras',         descricao: 'Entradas e saídas agrupadas por data com filtros avançados',      categoria: 'Financeiro',  icone: <FiRepeat size={20} />      },
  { id: 'fluxo_pagamento',  nome: 'Fluxo por Forma de Pagamento',      descricao: 'Totais por dinheiro, cartão, Pix e outras formas',               categoria: 'Financeiro',  icone: <FiCreditCard size={20} />  },
  { id: 'motivos_desconto', nome: 'Motivos de Desconto',               descricao: 'Descontos concedidos agrupados por tipo',                         categoria: 'Financeiro',  icone: <FiTag size={20} />         },
  { id: 'financeiro_prof',  nome: 'Financeiro por Profissional',       descricao: 'Faturamento e comissões por colaborador',                         categoria: 'Financeiro',  icone: <FiUser size={20} />        },
  { id: 'ticket_medio',        nome: 'Ticket Médio do Estabelecimento', descricao: 'Valor médio por atendimento — serviços, produtos e pacotes',       categoria: 'Financeiro',  icone: <FiTarget size={20} />      },

  // Equipe
  { id: 'comissoes',        nome: 'Comissões da Equipe',               descricao: 'Cálculo de comissões por profissional e período',                 categoria: 'Equipe',      icone: <FiPercent size={20} />     },
  { id: 'produtividade',    nome: 'Radar de Produtividade',            descricao: 'Eficiência e ocupação por profissional',                          categoria: 'Equipe',      icone: <FiBarChart2 size={20} />   },
  { id: 'capacidade',       nome: 'Capacidade e Ocupação',             descricao: 'Taxa de aproveitamento da agenda',                                categoria: 'Equipe',      icone: <FiClock size={20} />       },
  { id: 'ausencias',        nome: 'Bloqueios da Equipe',               descricao: 'Ausências, folgas e bloqueios registrados',                       categoria: 'Equipe',      icone: <FiSlash size={20} />       },

  // Clientes
  { id: 'retencao',         nome: 'Radar de Retenção',                 descricao: 'Clientes ativos, inativos e em risco de churn',                  categoria: 'Clientes',    icone: <FiUsers size={20} />       },
  { id: 'aniversariantes',  nome: 'Aniversariantes',                   descricao: 'Clientes com aniversário no período para ação de marketing',      categoria: 'Clientes',    icone: <FiGift size={20} />        },
  { id: 'clientes_debito',  nome: 'Clientes em Débito',                descricao: 'Clientes com valores em aberto',                                  categoria: 'Clientes',    icone: <FiAlertCircle size={20} /> },
  { id: 'credito_cliente',  nome: 'Crédito de Cliente',                descricao: 'Saldos de crédito pré-pago disponíveis',                         categoria: 'Clientes',    icone: <FiPackage size={20} />     },

  // Operacional
  { id: 'atendimentos',       nome: 'Relatório de Atendimentos',       descricao: 'Lista detalhada de todos os atendimentos realizados',             categoria: 'Operacional', icone: <FiList size={20} />        },
  { id: 'performance',        nome: 'Rankings de Performance',         descricao: 'Top clientes, profissionais e serviços',                          categoria: 'Operacional', icone: <FiAward size={20} />       },
  { id: 'termometro',         nome: 'Termômetro de Fluxo',             descricao: 'Heatmap de movimento por dia e hora',                             categoria: 'Operacional', icone: <FiThermometer size={20} /> },
  { id: 'dashboard_relatorio',nome: 'Dashboard Executivo',             descricao: 'KPIs e gráficos de visão geral do negócio',                      categoria: 'Operacional', icone: <FiGrid size={20} />        },

  // Auditoria
  { id: 'auditoria',          nome: 'Log de Auditoria',                descricao: 'Histórico de ações no sistema',                                   categoria: 'Auditoria',   icone: <FiFileText size={20} />    },
  { id: 'cancelamentos',      nome: 'Cancelamentos Suspeitos',         descricao: 'Cancelamentos fora do prazo ou padrão',                           categoria: 'Auditoria',   icone: <FiXCircle size={20} />     },
  { id: 'caixanaobate',       nome: 'Caixa Não Bate',                  descricao: 'Divergências entre caixa fechado e registros',                   categoria: 'Auditoria',   icone: <FiAlertTriangle size={20} />},
  { id: 'alertasestorno',     nome: 'Alertas de Estorno',              descricao: 'Estornos realizados com análise de padrão',                       categoria: 'Auditoria',   icone: <FiRefreshCw size={20} />   },
  { id: 'fechamento',         nome: 'Kit Fechamento Contábil',         descricao: 'Relatórios para envio ao contador',                               categoria: 'Auditoria',   icone: <FiBook size={20} />        },
];

const CATEGORIAS: Categoria[] = ['Todos', 'Financeiro', 'Equipe', 'Clientes', 'Operacional', 'Auditoria'];

// ─── COMPONENTE ───────────────────────────────────────────────────────────────

const PERMISSAO_POR_ID: Record<string, string> = {
  auditoria:      'auditoria.ver_log_auditoria',
  cancelamentos:  'auditoria.ver_cancelamentos',
  caixanaobate:   'auditoria.ver_caixa_nao_bate',
  alertasestorno: 'auditoria.ver_alertas_estorno',
};

export function GavetaRelatorioPrincipais({
  onNavegar,
  perfil,
}: {
  onNavegar: (rel: string) => void;
  perfil?: any;
}) {
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<Categoria>('Todos');
  const [hoverId, setHoverId] = useState<string | null>(null);

  function podeVer(item: ItemRelatorio): boolean {
    if (item.categoria !== 'Auditoria') return true;
    const chave = PERMISSAO_POR_ID[item.id];
    if (!chave) return true;
    return !!(perfil?.isDono || temPermissao(perfil, chave));
  }

  const itensVisiveis = (
    categoriaSelecionada === 'Todos' ? RELATORIOS : RELATORIOS.filter((r) => r.categoria === categoriaSelecionada)
  ).filter(podeVer).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '4px 0' }}>

      {/* ── TÍTULO ─────────────────────────────────────────────────────── */}
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: C.textMain, marginBottom: 4 }}>
          Relatórios do Sistema
        </h2>
        <p style={{ fontSize: 13, color: C.textMuted }}>
          Selecione um relatório para visualizar os dados detalhados.
        </p>
      </div>

      {/* ── FILTRO DE CATEGORIA ──────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {CATEGORIAS.map((cat) => {
          const ativa = cat === categoriaSelecionada;
          const cor = cat === 'Todos' ? { bg: C.sidebarBg, cor: '#fff' } : COR_BADGE[cat];
          return (
            <button
              key={cat}
              onClick={() => setCategoriaSelecionada(cat)}
              style={{
                padding: '6px 14px',
                borderRadius: RAIO_XL,
                border: ativa ? 'none' : `1px solid ${C.border}`,
                background: ativa ? (cat === 'Todos' ? C.sidebarBg : cor?.bg) : C.bgCard,
                color: ativa ? (cat === 'Todos' ? '#fff' : cor?.cor) : C.textMuted,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '0.4px',
                transition: 'all 0.15s',
              }}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* ── GRID DE CARDS ──────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 16,
      }}>
        {itensVisiveis.map((item) => {
          const badge = COR_BADGE[item.categoria];
          const estaHover = hoverId === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onNavegar(item.id)}
              onMouseEnter={() => setHoverId(item.id)}
              onMouseLeave={() => setHoverId(null)}
              style={{
                background: C.bgCard,
                border: `1px solid ${estaHover ? C.sidebarBg : C.border}`,
                borderRadius: RAIO_XL,
                padding: 20,
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                transition: 'border-color 0.15s',
              }}
            >
              {/* Ícone + Badge */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: badge?.cor || C.sidebarBg }}>{item.icone}</span>
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  padding: '3px 8px',
                  borderRadius: RAIO_XS,
                  background: badge?.bg || C.bg,
                  color: badge?.cor || C.textMuted,
                }}>
                  {item.categoria}
                </span>
              </div>

              {/* Nome */}
              <p style={{ fontSize: 14, fontWeight: 700, color: C.textMain, lineHeight: 1.3 }}>
                {item.nome}
              </p>

              {/* Descrição */}
              <p style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.5 }}>
                {item.descricao}
              </p>
            </button>
          );
        })}
      </div>

      {/* ── VAZIO ─────────────────────────────────────────────────────── */}
      {itensVisiveis.length === 0 && (
        <p style={{ fontSize: 13, color: C.textMuted, textAlign: 'center', padding: 40 }}>
          Nenhum relatório encontrado nesta categoria.
        </p>
      )}
    </div>
  );
}

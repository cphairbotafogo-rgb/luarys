/**
 * Catálogo de todos os itens possíveis da Sidebar, como dados — separado
 * do componente visual para permitir personalização por login (reordenar
 * e ocultar) sem tocar na lógica de permissões (RBAC).
 *
 * `condicao(perfil)` decide SE o item existe para aquele login — isso é
 * sempre a fonte da verdade de segurança/RBAC. A personalização
 * (ordem/ocultos) só atua DEPOIS desse filtro, nunca revela um item que
 * o login não tem permissão para ver.
 *
 * `fixo: true` marca itens que NUNCA entram na personalização — sempre
 * aparecem, sempre na posição definida aqui (Notas Fiscais, Migração de
 * Dados — sensíveis o suficiente para não serem ocultáveis/reordenáveis).
 */
import {
  FiLayout, FiTrendingUp, FiCalendar, FiSliders, FiUsers,
  FiDollarSign, FiBox, FiUserCheck, FiScissors, FiFileText,
  FiSettings, FiMonitor, FiMessageCircle, FiClock, FiZap, FiDatabase, FiGift,
} from 'react-icons/fi';
import { temPermissao } from '@/lib/permissoes';

export interface ItemSidebar {
  id: string;
  label: string;
  icon: React.ReactNode;
  secao: 'Operação' | 'Gestão & Negócio' | 'Fiscal & Ajustes';
  fixo?: boolean;
  bloqueado?: (perfil: any) => boolean;
  condicao: (perfil: any) => boolean;
}

function podeVerEstoque(perfil: any): boolean {
  const pAcesso = perfil?.permissoes?.perfil_acesso || '';
  return perfil?.isDono || [
    'Administrador', 'Administrativo', 'Gerente', 'Estoquista', 'Recepcionista', 'Recepção',
  ].includes(pAcesso);
}

export const CATALOGO_ITENS_SIDEBAR: ItemSidebar[] = [
  // ── Operação ──
  { id: 'dashboard', label: 'Visão Geral', icon: <FiLayout size={18} />, secao: 'Operação',
    condicao: (perfil) => !!perfil?.permissoes?.ver_dashboard },
  { id: 'crescimento', label: 'Luarys Cresce', icon: <FiZap size={18} />, secao: 'Operação',
    condicao: (perfil) => perfil?.isDono || temPermissao(perfil, 'modulo.crescimento'),
    bloqueado: (perfil) => !perfil?.moduloCrescimentoLiberado },
  { id: 'agenda', label: 'Agendamento', icon: <FiSliders size={18} />, secao: 'Operação',
    condicao: () => true },
  { id: 'crm', label: 'CRM de Clientes', icon: <FiUsers size={18} />, secao: 'Operação',
    condicao: () => true },
  { id: 'aniversario', label: 'Aniversariantes', icon: <FiGift size={18} />, secao: 'Operação',
    condicao: () => true },
  { id: 'caixa', label: 'Frente de Caixa', icon: <FiMonitor size={18} />, secao: 'Operação',
    condicao: () => true },
  { id: 'lista_espera', label: 'Fila de Espera', icon: <FiClock size={18} />, secao: 'Operação',
    condicao: () => true },
  { id: 'comunicacao', label: 'Comunicação', icon: <FiMessageCircle size={18} />, secao: 'Operação',
    condicao: (perfil) => !!perfil?.isDono,
    bloqueado: (perfil) => !perfil?.moduloComunicacaoLiberado },

  // ── Gestão & Negócio ──
  { id: 'financeiro', label: 'Financeiro', icon: <FiDollarSign size={18} />, secao: 'Gestão & Negócio',
    condicao: (perfil) => !!perfil?.permissoes?.ver_financeiro,
    bloqueado: (perfil) => !perfil?.moduloFinanceiroLiberado },
  { id: 'estoque', label: 'Controle de Estoque', icon: <FiBox size={18} />, secao: 'Gestão & Negócio',
    condicao: podeVerEstoque,
    bloqueado: (perfil) => !perfil?.moduloEstoqueLiberado },
  { id: 'equipe', label: 'Minha Equipe', icon: <FiUserCheck size={18} />, secao: 'Gestão & Negócio',
    condicao: (perfil) => !!perfil?.permissoes?.editar_equipe },
  { id: 'precificacao', label: 'Luarys Precifica', icon: <FiSliders size={18} />, secao: 'Gestão & Negócio',
    condicao: (perfil) => perfil?.isDono || temPermissao(perfil, 'modulo.precificacao'),
    bloqueado: (perfil) => !perfil?.moduloPrecificacaoLiberado },

  // ── Fiscal & Ajustes ──
  { id: 'relatorios', label: 'Inteligência', icon: <FiTrendingUp size={18} />, secao: 'Fiscal & Ajustes',
    condicao: (perfil) => !!perfil?.permissoes?.ver_dashboard || !!perfil?.permissoes?.ver_financeiro,
    bloqueado: (perfil) => !perfil?.moduloRelatoriosLiberado },
  { id: 'servicos', label: 'Serviços e Preços', icon: <FiScissors size={18} />, secao: 'Fiscal & Ajustes',
    condicao: (perfil) => perfil?.isDono || temPermissao(perfil, 'modulo.servicos') },

  // ── Fixos — nunca ocultáveis/reordenáveis ──
  { id: 'nfse_setup', label: 'Configurar NFS-e', icon: <FiSettings size={16} />, secao: 'Fiscal & Ajustes',
    fixo: true, condicao: (perfil) => !!perfil?.isDono,
    bloqueado: (perfil) => !perfil?.moduloFiscalLiberado },
  { id: 'nfse', label: 'Emitir NFS-e', icon: <FiFileText size={16} />, secao: 'Fiscal & Ajustes',
    fixo: true, condicao: (perfil) => !!perfil?.isDono,
    bloqueado: (perfil) => !perfil?.moduloFiscalLiberado },
  { id: 'nfce', label: 'Produtos (NFC-e)', icon: <FiDatabase size={16} />, secao: 'Fiscal & Ajustes',
    fixo: true, condicao: (perfil) => !!perfil?.isDono,
    bloqueado: (perfil) => !perfil?.moduloFiscalLiberado },
  { id: 'migracao', label: 'Migração de Dados', icon: <FiDatabase size={18} />, secao: 'Fiscal & Ajustes',
    fixo: true, condicao: (perfil) => !!perfil?.isDono },

  { id: 'configuracoes', label: 'Configurações', icon: <FiSettings size={18} />, secao: 'Fiscal & Ajustes',
    condicao: (perfil) => perfil?.isDono || temPermissao(perfil, 'modulo.configuracoes') },
];

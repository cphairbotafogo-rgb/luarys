'use client'
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/constants";
import { RAIO_MD } from "@/lib/estiloGlobal";
import { InputData } from "@/components/InputData";
import { temPermissao } from "@/lib/permissoes";
import { FiPieChart, FiThermometer, FiAward, FiLoader, FiUsers, FiBookOpen, FiGift, FiShield, FiAlertTriangle, FiAlertOctagon, FiRotateCcw, FiClock, FiList, FiUserX, FiZap, FiDollarSign, FiCreditCard, FiTag, FiAlertCircle, FiUser, FiBarChart2, FiGrid, FiSearch, FiChevronDown, FiChevronRight } from "react-icons/fi";

// ─── IMPORTAÇÃO DAS GAVETAS ───
import { GavetaBalanco } from "./gavetas/GavetaBalanco";
import { GavetaTermometro } from "./gavetas/GavetaTermometro";
import { GavetaRankings } from "./gavetas/GavetaRankings";
import { GavetaComissoes } from "./gavetas/GavetaComissoes";
import { GavetaFechamentoContabil } from "./gavetas/GavetaFechamentoContabil";
import { GavetaAniversariantes } from "./gavetas/GavetaAniversariantes";
import { GavetaAuditoria } from "./gavetas/GavetaAuditoria";
import { GavetaCancelamentos } from "./gavetas/GavetaCancelamentos";
import { GavetaCaixaNaoBate } from "./gavetas/GavetaCaixaNaoBate";
import { GavetaAlertasEstorno } from "./gavetas/GavetaAlertasEstorno";
import { GavetaCapacidade } from "./gavetas/GavetaCapacidade";
import { GavetaAtendimentos } from "./gavetas/GavetaAtendimentos";
import { GavetaAusencias } from "./gavetas/GavetaAusencias";
import { GavetaProdutividade } from "./gavetas/produtividade/GavetaProdutividade";
import { GavetaMovimentacoes } from "./gavetas/GavetaMovimentacoes";
import { GavetaFluxoPagamento } from "./gavetas/GavetaFluxoPagamento";
import { GavetaMotivosDesconto } from "./gavetas/GavetaMotivosDesconto";
import { GavetaClientesDebito } from "./gavetas/GavetaClientesDebito";
import { GavetaCreditoCliente } from "./gavetas/GavetaCreditoCliente";
import { GavetaFinanceiroProfissional } from "./gavetas/GavetaFinanceiroProfissional";
import { GavetaDashboard } from "./gavetas/GavetaDashboard";
import { GavetaRelatorioPrincipais } from "./gavetas/GavetaRelatorioPrincipais";
import { GavetaComparativo } from "./gavetas/GavetaComparativo";
import { GavetaBuscaServico } from "./gavetas/GavetaBuscaServico";
import { GavetaRepasse } from "./gavetas/GavetaRepasse";
import { GavetaPgdasd } from "./gavetas/GavetaPgdasd";
import { GavetaEfdReinf } from "./gavetas/GavetaEfdReinf";
import { GavetaGraficos } from "./gavetas/GavetaGraficos";

export function AbaRelatorios({ perfil }: any) {
  const [relatorioAtivo, setRelatorioAtivo] = useState(() => {
    // Permite deep-link via sessionStorage (ex: botão "Fechar Caixa" do PDV)
    const inicial = typeof window !== 'undefined' ? sessionStorage.getItem('relatorios_aba_inicial') : null;
    if (inicial) { sessionStorage.removeItem('relatorios_aba_inicial'); return inicial; }
    return "balanco";
  });
  const [carregando, setCarregando] = useState(true);
  const [avisoTruncado, setAvisoTruncado] = useState(false);
  const anoAtual = new Date().getFullYear();
  const [dataIni, setDataIni] = useState(`${anoAtual}-01-01`);
  const [dataFim, setDataFim] = useState(new Date().toISOString().split('T')[0]);

  const [dadosBase, setDadosBase] = useState<{ financeiro: any[]; agendamentos: any[]; clientes: any[]; servicos: any[]; profs: any[]; despesas: any[]; produtos: any[]; histEstoque: any[]; comissoes: any[] }>({ financeiro: [], agendamentos: [], clientes: [], servicos: [], profs: [], despesas: [], produtos: [], histEstoque: [], comissoes: [] });
  const [secsColapsadas, setSecsColapsadas] = useState<Set<string>>(new Set());
  function toggleSec(sec: string) { setSecsColapsadas(prev => { const n = new Set(prev); n.has(sec) ? n.delete(sec) : n.add(sec); return n; }); }

  // Extraí a função para podermos chamar ela de novo após salvar uma despesa
  async function buscarDados() {
    if (!perfil?.salao_id) return;
    setCarregando(true);
    setAvisoTruncado(false);

    const ini = dataIni;
    const fim = dataFim;

    const [resFin, resAg, resCli, resServ, resProf, resDesp, resProd, resHist, resCom] = await Promise.all([
      supabase.from('financeiro').select('id, tipo, status, categoria, descricao, valor, data_movimentacao, forma_pagamento, bandeira_cartao, desconto, tipo_desconto, created_at, cliente_nome, os_numero, pagamentos').eq('salao_id', perfil.salao_id).gte('data_movimentacao', `${ini}T00:00:00Z`).lte('data_movimentacao', `${fim}T23:59:59Z`).limit(2000),
      supabase.from('agendamentos').select('id, cliente_id, cliente_nome, profissional_id, servico_id, data, inicio, status, valor_final, valor_sinal, duracao_min, observacao, cor, desconto, tipo_desconto, created_at, servicos(nome_servico, categoria)').eq('salao_id', perfil.salao_id).gte('data', ini).lte('data', fim).limit(2000),
      supabase.from('clientes').select('id, nome_completo, nascimento, created_at, telefone_whatsapp, cpf, email, foto_url').eq('salao_id', perfil.salao_id).limit(2000),
      supabase.from('servicos').select('id, nome_servico, categoria, preco_padrao, duracao_minutos, ativo').eq('salao_id', perfil.salao_id).limit(500),
      supabase.from('profissionais').select('id, nome, foto_url, cargo, ativo, perfil_avancado, servicos_comissoes').eq('salao_id', perfil.salao_id).limit(200),
      supabase.from('despesas').select('id, descricao, categoria, valor, data_pagamento, data_vencimento, status, forma_pagamento, observacao').eq('salao_id', perfil.salao_id).gte('data_vencimento', ini).lte('data_vencimento', fim).limit(2000),
      supabase.from('produtos').select('id, nome_produto, categoria, preco_venda, custo_medio, unidade_medida').eq('salao_id', perfil.salao_id).limit(500),
      supabase.from('historico_estoque').select('produto_id, tipo, quantidade, motivo, created_at').eq('salao_id', perfil.salao_id).gte('created_at', `${ini}T00:00:00Z`).lte('created_at', `${fim}T23:59:59Z`).limit(2000),
      supabase.from('comissoes').select('id, valor_comissao, created_at, data_evento, status').eq('salao_id', perfil.salao_id).gte('data_evento', ini).lte('data_evento', fim).limit(2000),
    ]);

    // Avisa se alguma coleção atingiu o limite (dados podem estar incompletos)
    const atingiuLimite = [resFin, resAg, resDesp, resHist, resCom].some(r => (r.data?.length || 0) >= 2000);
    if (atingiuLimite) setAvisoTruncado(true);

    setDadosBase({
      financeiro:   resFin.data  || [],
      agendamentos: resAg.data   || [],
      clientes:     resCli.data  || [],
      servicos:     resServ.data || [],
      profs:        resProf.data || [],
      despesas:     resDesp.data || [],
      produtos:     resProd.data || [],
      histEstoque:  resHist.data || [],
      comissoes:    resCom.data  || [],
    });

    setCarregando(false);
  }

  useEffect(() => {
    buscarDados();
  }, [perfil]);

  // ─── REFINAMENTO DE ESTILOS (Mapeamento de Cores da Paleta) ───
  const menuBtnStyle = (ativo: boolean) => ({
    width: "100%",
    padding: "9px 12px",
    background: ativo ? "#F1F5F9" : "transparent",
    color: ativo ? C.sidebarBg : C.textLight,
    border: "none",
    borderRadius: RAIO_MD,
    textAlign: "left" as const,
    fontSize: 12,
    fontWeight: ativo ? 700 : 500,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 9,
    transition: "0.2s ease-in-out"
  });

  const nomesRelatorios: any = {
    'relatorios_principais': 'Relatórios Principais',
    'dashboard_relatorio':   'Dashboard Executivo',
    'comissoes':             'Comissões da Equipe',
    'balanco':               'Demonstrativo de Resultados (DRE)',
    'termometro':            'Termômetro de Fluxo',
    'performance':           'Rankings de Performance',
    'fechamento':            'Kit Fechamento Contábil',
    'aniversariantes':       'Aniversariantes',
    'auditoria':             'Log de Auditoria',
    'cancelamentos':         'Cancelamentos Pós-Horário',
    'caixanaobate':          'Caixa Não Bate',
    'alertasestorno':        'Alertas de Estorno',
    'capacidade':            'Capacidade e Ocupação',
    'atendimentos':          'Relatório de Atendimentos',
    'ausencias':             'Bloqueios da Equipe',
    'produtividade':         'Radar de Produtividade',
    'movimentacoes':         'Movimentações Financeiras',
    'fluxo_pagamento':       'Fluxo por Forma de Pagamento',
    'motivos_desconto':      'Motivos de Desconto',
    'clientes_debito':       'Clientes em Débito',
    'credito_cliente':       'Crédito de Cliente',
    'financeiro_prof':       'Financeiro por Profissional',
    'comparativo':           'Comparativo de Períodos',
    'busca_servico':         'Clientes por Serviço Realizado',
    'ticket_medio':          'Ticket Médio do Estabelecimento',
    'repasse_profissionais': 'Repasse de Profissionais Parceiros',
    'pgdas_d':               'Apuração PGDAS-D (Simples Nacional)',
    'efd_reinf':             'EFD-Reinf R-4010 / eSocial S-2300',
    'graficos':              'Gráficos do Período',
  };

  if (carregando && dadosBase.financeiro.length === 0) return (
    <div style={{ display: "flex", height: "100%", width: "100%", alignItems: "center", justifyContent: "center", color: C.sidebarBg, fontWeight: 700, gap: 12 }}>
      <FiLoader className="animate-spin" size={18} /> A compilar inteligência de dados...
    </div>
  );

  return (
    <div className="font-body" style={{ display: "flex", height: "100%", background: C.bg }}>
      
      {/* MENU LATERAL DOS RELATÓRIOS */}
      <div style={{ width: 240, background: C.bgCard, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", padding: '24px 16px', overflowY: "auto" }}>
        <h2 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 800, color: C.sidebarBg, paddingLeft: 8 }}>
          Inteligência & Dados
        </h2>
        
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>

          <button style={menuBtnStyle(relatorioAtivo === 'relatorios_principais')} onClick={() => setRelatorioAtivo('relatorios_principais')}>
            <FiGrid size={16} /> Relatórios Principais
          </button>
          <button style={menuBtnStyle(relatorioAtivo === 'dashboard_relatorio')} onClick={() => setRelatorioAtivo('dashboard_relatorio')}>
            <FiBarChart2 size={16} /> Dashboard Executivo
          </button>

          {(perfil?.isDono || perfil?.permissoes?.ver_financeiro) && (<>
          <div style={{ height: 1, background: C.border, margin: '6px 0' }} />
          <button onClick={() => toggleSec('fin')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', width: '100%' }}>
            <span style={{ fontSize: 9, fontWeight: 800, color: C.textLight, textTransform: 'uppercase' as const, letterSpacing: '0.8px' }}>Financeiro</span>
            {secsColapsadas.has('fin') ? <FiChevronRight size={12} color={C.textLight} /> : <FiChevronDown size={12} color={C.textLight} />}
          </button>

          {!secsColapsadas.has('fin') && <>
          <button style={menuBtnStyle(relatorioAtivo === 'balanco')} onClick={() => setRelatorioAtivo('balanco')}>
            <FiPieChart size={16} /> Balanço / DRE
          </button>
          <button style={menuBtnStyle(relatorioAtivo === 'movimentacoes')} onClick={() => setRelatorioAtivo('movimentacoes')}>
            <FiDollarSign size={16} /> Movimentações
          </button>
          <button style={menuBtnStyle(relatorioAtivo === 'fluxo_pagamento')} onClick={() => setRelatorioAtivo('fluxo_pagamento')}>
            <FiCreditCard size={16} /> Fluxo por Pagamento
          </button>
          <button style={menuBtnStyle(relatorioAtivo === 'motivos_desconto')} onClick={() => setRelatorioAtivo('motivos_desconto')}>
            <FiTag size={16} /> Motivos de Desconto
          </button>
          <button style={menuBtnStyle(relatorioAtivo === 'clientes_debito')} onClick={() => setRelatorioAtivo('clientes_debito')}>
            <FiAlertCircle size={16} /> Clientes em Débito
          </button>
          <button style={menuBtnStyle(relatorioAtivo === 'credito_cliente')} onClick={() => setRelatorioAtivo('credito_cliente')}>
            <FiCreditCard size={16} /> Crédito de Cliente
          </button>
          <button style={menuBtnStyle(relatorioAtivo === 'financeiro_prof')} onClick={() => setRelatorioAtivo('financeiro_prof')}>
            <FiUser size={16} /> Financeiro por Profissional
          </button>
          <button style={menuBtnStyle(relatorioAtivo === 'comparativo')} onClick={() => setRelatorioAtivo('comparativo')}>
            <FiBarChart2 size={16} /> Comparativo de Períodos
          </button>
          <button style={menuBtnStyle(relatorioAtivo === 'graficos')} onClick={() => setRelatorioAtivo('graficos')}>
            <FiBarChart2 size={16} /> Gráficos do Período
          </button>
          </>}
          </>)}

          <div style={{ height: 1, background: C.border, margin: '6px 0' }} />
          <button onClick={() => toggleSec('equipe')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', width: '100%' }}>
            <span style={{ fontSize: 9, fontWeight: 800, color: C.textLight, textTransform: 'uppercase' as const, letterSpacing: '0.8px' }}>Equipe & Clientes</span>
            {secsColapsadas.has('equipe') ? <FiChevronRight size={12} color={C.textLight} /> : <FiChevronDown size={12} color={C.textLight} />}
          </button>

          {!secsColapsadas.has('equipe') && <>
          <button style={menuBtnStyle(relatorioAtivo === 'comissoes')} onClick={() => setRelatorioAtivo('comissoes')}>
            <FiUsers size={16} /> Comissões da Equipe
          </button>
          <button style={menuBtnStyle(relatorioAtivo === 'termometro')} onClick={() => setRelatorioAtivo('termometro')}>
            <FiThermometer size={16} /> Termômetro de Fluxo
          </button>
          <button style={menuBtnStyle(relatorioAtivo === 'performance')} onClick={() => setRelatorioAtivo('performance')}>
            <FiAward size={16} /> Rankings de Performance
          </button>
          <button style={menuBtnStyle(relatorioAtivo === 'atendimentos')} onClick={() => setRelatorioAtivo('atendimentos')}>
            <FiList size={16} /> Relatório de Atendimentos
          </button>
          <button style={menuBtnStyle(relatorioAtivo === 'ausencias')} onClick={() => setRelatorioAtivo('ausencias')}>
            <FiUserX size={16} /> Bloqueios da Equipe
          </button>
          <button style={menuBtnStyle(relatorioAtivo === 'produtividade')} onClick={() => setRelatorioAtivo('produtividade')}>
            <FiZap size={13} /> Radar de Produtividade
          </button>
          <button style={menuBtnStyle(relatorioAtivo === 'aniversariantes')} onClick={() => setRelatorioAtivo('aniversariantes')}>
            <FiGift size={16} /> Aniversariantes
          </button>
          <button style={menuBtnStyle(relatorioAtivo === 'busca_servico')} onClick={() => setRelatorioAtivo('busca_servico')}>
            <FiSearch size={16} /> Clientes por Serviço
          </button>
          </>}

          <div style={{ height: 1, background: C.border, margin: '6px 0' }} />
          <button onClick={() => toggleSec('audit')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', width: '100%' }}>
            <span style={{ fontSize: 9, fontWeight: 800, color: C.textLight, textTransform: 'uppercase' as const, letterSpacing: '0.8px' }}>Contábil & Auditoria</span>
            {secsColapsadas.has('audit') ? <FiChevronRight size={12} color={C.textLight} /> : <FiChevronDown size={12} color={C.textLight} />}
          </button>

          {!secsColapsadas.has('audit') && <>
          <button style={menuBtnStyle(relatorioAtivo === 'fechamento')} onClick={() => setRelatorioAtivo('fechamento')}>
            <FiBookOpen size={16} /> Kit Fechamento Contábil
          </button>
          <button style={menuBtnStyle(relatorioAtivo === 'repasse_profissionais')} onClick={() => setRelatorioAtivo('repasse_profissionais')}>
            <FiDollarSign size={16} /> Repasse de Parceiros
          </button>
          <button style={menuBtnStyle(relatorioAtivo === 'pgdas_d')} onClick={() => setRelatorioAtivo('pgdas_d')}>
            <FiPieChart size={16} /> Base PGDAS-D
          </button>
          <button style={menuBtnStyle(relatorioAtivo === 'efd_reinf')} onClick={() => setRelatorioAtivo('efd_reinf')}>
            <FiBookOpen size={16} /> EFD-Reinf / eSocial
          </button>
          {(perfil?.isDono || temPermissao(perfil, 'auditoria.ver_log_auditoria')) && (
            <button style={menuBtnStyle(relatorioAtivo === 'auditoria')} onClick={() => setRelatorioAtivo('auditoria')}>
              <FiShield size={16} /> Log de Auditoria
            </button>
          )}
          {(perfil?.isDono || temPermissao(perfil, 'auditoria.ver_cancelamentos')) && (
            <button style={menuBtnStyle(relatorioAtivo === 'cancelamentos')} onClick={() => setRelatorioAtivo('cancelamentos')}>
              <FiAlertTriangle size={16} /> Cancelamentos Suspeitos
            </button>
          )}
          {(perfil?.isDono || temPermissao(perfil, 'auditoria.ver_caixa_nao_bate')) && (
            <button style={menuBtnStyle(relatorioAtivo === 'caixanaobate')} onClick={() => setRelatorioAtivo('caixanaobate')}>
              <FiAlertOctagon size={16} /> Caixa Não Bate
            </button>
          )}
          {(perfil?.isDono || temPermissao(perfil, 'auditoria.ver_alertas_estorno')) && (
            <button style={menuBtnStyle(relatorioAtivo === 'alertasestorno')} onClick={() => setRelatorioAtivo('alertasestorno')}>
              <FiRotateCcw size={16} /> Alertas de Estorno
            </button>
          )}
          {(perfil?.isDono || temPermissao(perfil, 'auditoria.ver_extrato_capacidade_equipe') || temPermissao(perfil, 'auditoria.ver_extrato_capacidade_proprio')) && (
            <button style={menuBtnStyle(relatorioAtivo === 'capacidade')} onClick={() => setRelatorioAtivo('capacidade')}>
              <FiClock size={16} /> Capacidade e Ocupação
            </button>
          )}
          </>}
        </div>
      </div>

      {/* ÁREA DE EXIBIÇÃO DA GAVETA ESCOLHIDA */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        
        {/* CABEÇALHO DO RELATÓRIO ATIVO */}
        <div style={{ padding: "24px 32px", background: C.bgCard, borderBottom: `1px solid ${C.borderMid}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 className="font-title uppercase tracking-widest" style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.textMain }}>
              {nomesRelatorios[relatorioAtivo]}
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: C.textMuted }}>Análise estruturada em tempo real.</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.textMuted }}>Período:</label>
            <InputData value={dataIni} onChange={setDataIni}
              style={{ fontSize: 12, padding: "6px 10px", borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, color: C.textMain, background: C.bg }} />
            <span style={{ fontSize: 11, color: C.textMuted }}>até</span>
            <InputData value={dataFim} onChange={setDataFim} min={dataIni}
              style={{ fontSize: 12, padding: "6px 10px", borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, color: C.textMain, background: C.bg }} />
            {[
              { label: 'Este mês', fn: () => { const d = new Date(); setDataIni(new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]); setDataFim(d.toISOString().split('T')[0]); } },
              { label: 'Este ano', fn: () => { const d = new Date(); setDataIni(`${d.getFullYear()}-01-01`); setDataFim(d.toISOString().split('T')[0]); } },
              { label: String(anoAtual - 1), fn: () => { setDataIni(`${anoAtual - 1}-01-01`); setDataFim(`${anoAtual - 1}-12-31`); } },
            ].map(p => (
              <button key={p.label} onClick={p.fn}
                style={{ fontSize: 11, fontWeight: 600, padding: "5px 10px", borderRadius: 20, border: `1px solid ${C.borderMid}`, background: "transparent", color: C.textMain, cursor: "pointer" }}>
                {p.label}
              </button>
            ))}
            <button onClick={buscarDados}
              style={{ fontSize: 11, fontWeight: 700, padding: "6px 14px", borderRadius: RAIO_MD, border: "none", background: C.sidebarBg, color: "#fff", cursor: "pointer" }}>
              Aplicar
            </button>
            {avisoTruncado && (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#B45309', background: '#FEF3C7', padding: "4px 10px", borderRadius: RAIO_MD, border: "1px solid #FDE68A" }}>
                ⚠ Volume alto
              </span>
            )}
          </div>
        </div>

        {/* CONTEÚDO DA GAVETA */}
        <div style={{ flex: 1, padding: 32, overflowY: "auto" }}>
          {relatorioAtivo === 'relatorios_principais' && <GavetaRelatorioPrincipais onNavegar={setRelatorioAtivo} perfil={perfil} />}
          {relatorioAtivo === 'dashboard_relatorio' && <GavetaDashboard dados={dadosBase} />}
          {relatorioAtivo === 'comissoes' && <GavetaComissoes perfil={perfil} />}
          {relatorioAtivo === 'balanco' && <GavetaBalanco dados={dadosBase} perfil={perfil} />}
          {relatorioAtivo === 'termometro' && <GavetaTermometro dados={dadosBase} />}
          {relatorioAtivo === 'performance' && <GavetaRankings dados={dadosBase} perfil={perfil} />}
          {relatorioAtivo === 'atendimentos' && <GavetaAtendimentos dados={dadosBase} perfil={perfil} />}
          {relatorioAtivo === 'ausencias' && <GavetaAusencias perfil={perfil} />}
          {relatorioAtivo === 'produtividade' && <GavetaProdutividade perfil={perfil} />}
          {relatorioAtivo === 'fechamento' && <GavetaFechamentoContabil perfil={perfil} />}
          {relatorioAtivo === 'aniversariantes' && <GavetaAniversariantes dados={dadosBase} perfil={perfil} />}
          {relatorioAtivo === 'movimentacoes' && ((perfil?.isDono || perfil?.permissoes?.ver_financeiro) ? <GavetaMovimentacoes dados={dadosBase} /> : <p style={{ color: C.danger, fontWeight: 700 }}>Acesso restrito.</p>)}
          {relatorioAtivo === 'fluxo_pagamento' && ((perfil?.isDono || perfil?.permissoes?.ver_financeiro) ? <GavetaFluxoPagamento dados={dadosBase} perfil={perfil} /> : <p style={{ color: C.danger, fontWeight: 700 }}>Acesso restrito.</p>)}
          {relatorioAtivo === 'motivos_desconto' && ((perfil?.isDono || perfil?.permissoes?.ver_financeiro) ? <GavetaMotivosDesconto dados={dadosBase} /> : <p style={{ color: C.danger, fontWeight: 700 }}>Acesso restrito.</p>)}
          {relatorioAtivo === 'clientes_debito' && ((perfil?.isDono || perfil?.permissoes?.ver_financeiro) ? <GavetaClientesDebito perfil={perfil} /> : <p style={{ color: C.danger, fontWeight: 700 }}>Acesso restrito.</p>)}
          {relatorioAtivo === 'credito_cliente' && ((perfil?.isDono || perfil?.permissoes?.ver_financeiro) ? <GavetaCreditoCliente perfil={perfil} /> : <p style={{ color: C.danger, fontWeight: 700 }}>Acesso restrito.</p>)}
          {relatorioAtivo === 'financeiro_prof' && ((perfil?.isDono || perfil?.permissoes?.ver_financeiro) ? <GavetaFinanceiroProfissional dados={dadosBase} perfil={perfil} /> : <p style={{ color: C.danger, fontWeight: 700 }}>Acesso restrito.</p>)}
          {relatorioAtivo === 'comparativo' && ((perfil?.isDono || perfil?.permissoes?.ver_financeiro) ? <GavetaComparativo perfil={perfil} /> : <p style={{ color: C.danger, fontWeight: 700 }}>Acesso restrito.</p>)}
          {relatorioAtivo === 'auditoria' && ((perfil?.isDono || temPermissao(perfil, 'auditoria.ver_log_auditoria')) ? <GavetaAuditoria perfil={perfil} /> : <p style={{ color: C.danger, fontWeight: 700 }}>Acesso restrito.</p>)}
          {relatorioAtivo === 'cancelamentos' && ((perfil?.isDono || temPermissao(perfil, 'auditoria.ver_cancelamentos')) ? <GavetaCancelamentos perfil={perfil} /> : <p style={{ color: C.danger, fontWeight: 700 }}>Acesso restrito.</p>)}
          {relatorioAtivo === 'caixanaobate' && ((perfil?.isDono || temPermissao(perfil, 'auditoria.ver_caixa_nao_bate')) ? <GavetaCaixaNaoBate perfil={perfil} /> : <p style={{ color: C.danger, fontWeight: 700 }}>Acesso restrito.</p>)}
          {relatorioAtivo === 'alertasestorno' && ((perfil?.isDono || temPermissao(perfil, 'auditoria.ver_alertas_estorno')) ? <GavetaAlertasEstorno perfil={perfil} /> : <p style={{ color: C.danger, fontWeight: 700 }}>Acesso restrito.</p>)}
          {relatorioAtivo === 'capacidade' && ((perfil?.isDono || temPermissao(perfil, 'auditoria.ver_extrato_capacidade_equipe') || temPermissao(perfil, 'auditoria.ver_extrato_capacidade_proprio')) ? <GavetaCapacidade dados={dadosBase} perfil={perfil} /> : <p style={{ color: C.danger, fontWeight: 700 }}>Acesso restrito.</p>)}
          {relatorioAtivo === 'busca_servico' && <GavetaBuscaServico dados={dadosBase} perfil={perfil} />}
          {relatorioAtivo === 'ticket_medio' && <GavetaDashboard dados={dadosBase} />}
          {relatorioAtivo === 'repasse_profissionais' && ((perfil?.isDono || perfil?.permissoes?.ver_financeiro) ? <GavetaRepasse perfil={perfil} /> : <p style={{ color: C.danger, fontWeight: 700 }}>Acesso restrito.</p>)}
          {relatorioAtivo === 'pgdas_d' && ((perfil?.isDono || perfil?.permissoes?.ver_financeiro) ? <GavetaPgdasd perfil={perfil} /> : <p style={{ color: C.danger, fontWeight: 700 }}>Acesso restrito.</p>)}
          {relatorioAtivo === 'efd_reinf' && ((perfil?.isDono || perfil?.permissoes?.ver_financeiro) ? <GavetaEfdReinf perfil={perfil} /> : <p style={{ color: C.danger, fontWeight: 700 }}>Acesso restrito.</p>)}
          {relatorioAtivo === 'graficos' && ((perfil?.isDono || perfil?.permissoes?.ver_financeiro) ? <GavetaGraficos dados={dadosBase} perfil={perfil} /> : <p style={{ color: C.danger, fontWeight: 700 }}>Acesso restrito.</p>)}
        </div>

      </div>


    </div>
  );
}
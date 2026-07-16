'use client'
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { C, brl } from '@/lib/constants';
import { RAIO_SM, RAIO_MD, RAIO_XL } from '@/lib/estiloGlobal';
import { Card } from '@/components/ui';
import { PainelMetas } from './PainelMetas';
import { temPermissao } from '@/lib/permissoes';
import { ModalBoasVindas } from '@/components/ModalBoasVindas';
import {
  FiCreditCard, FiActivity, FiLayers,
  FiCalendar, FiDollarSign, FiUsers, FiBarChart2,
  FiScissors,
} from 'react-icons/fi';

// ── Componente principal ──────────────────────────────────────────────────────
export function AbaDashboard({ perfil, setAba }: any) {
  const [carregando, setCarregando] = useState(true);
  const [comissoesMes, setComissoesMes] = useState(0);
  const [metricas, setMetricas] = useState({
    faturamento: 0, despesas: 0, lucro: 0,
    ticketMedio: 0, totalAtendimentos: 0, sa: 0,
    topServicos: [] as any[],
  });

  // ── Carga principal do mês corrente ────────────────────────────────────────
  useEffect(() => {
    async function carregarDados() {
      if (!perfil?.salao_id) return;
      setCarregando(true);

      const agora = new Date();
      const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString().split('T')[0];
      const fimMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).toISOString().split('T')[0];

      try {
        const [resFin, resAg, resSrv, resDespV, resDespP, resComis] = await Promise.all([
          supabase.from('financeiro').select('tipo, valor, status, data_movimentacao')
            .eq('salao_id', perfil.salao_id)
            .neq('status', 'Estornado')
            .gte('data_movimentacao', `${inicioMes}T00:00:00Z`)
            .lte('data_movimentacao', `${fimMes}T23:59:59Z`),
          supabase.from('agendamentos').select('status, data, servico_id, cliente_id')
            .eq('salao_id', perfil.salao_id)
            .gte('data', inicioMes).lte('data', fimMes),
          supabase.from('servicos').select('id, nome_servico').eq('salao_id', perfil.salao_id),
          supabase.from('despesas').select('id, valor').eq('salao_id', perfil.salao_id)
            .neq('status', 'Estornado').gte('data_vencimento', inicioMes).lte('data_vencimento', fimMes),
          supabase.from('despesas').select('id, valor').eq('salao_id', perfil.salao_id)
            .neq('status', 'Estornado').gte('data_pagamento', inicioMes).lte('data_pagamento', fimMes),
          // Comissão conta no mês do SERVIÇO (data_evento), consistente com faturamento
          // e atendimentos. Antes usava created_at (dia do fechamento), o que jogava
          // comissões de fechamentos retroativos no mês errado.
          supabase.from('comissoes').select('valor_comissao').eq('salao_id', perfil.salao_id)
            .gte('data_evento', inicioMes).lte('data_evento', fimMes),
        ]);

        const movsMes = resFin.data || [];
        const agsMes = (resAg.data || []).filter(ag => ag.status === 'Finalizado');

        const entradas = movsMes.filter(f => f.tipo === 'entrada' && f.status !== 'Estornado').reduce((acc, f) => acc + Number(f.valor), 0);
        const saidasFin = movsMes.filter(f => f.tipo === 'saida').reduce((acc, f) => acc + Number(f.valor), 0);
        const despMap = new Map<string, number>();
        [...(resDespV.data || []), ...(resDespP.data || [])].forEach((d: any) => despMap.set(d.id, Number(d.valor)));
        const saidas = saidasFin + Array.from(despMap.values()).reduce((a, v) => a + v, 0);
        const totalAgs = agsMes.length;
        const ticket = totalAgs > 0 ? entradas / totalAgs : 0;

        const clientesUnicos = new Set(agsMes.map(ag => ag.cliente_id).filter(Boolean)).size;
        const sa = clientesUnicos > 0 ? totalAgs / clientesUnicos : 0;

        const srvMap = new Map((resSrv.data || []).map((s: any) => [s.id, s]));
        const contagemServicos: Record<string, number> = {};
        agsMes.forEach(ag => {
          const nome = (srvMap.get(ag.servico_id) as any)?.nome_servico || 'Outros';
          contagemServicos[nome] = (contagemServicos[nome] || 0) + 1;
        });

        const top5 = Object.entries(contagemServicos)
          .map(([nome, quantidade]) => ({ nome, quantidade }))
          .sort((a, b) => b.quantidade - a.quantidade)
          .slice(0, 5);

        const totalComissoes = (resComis.data || []).reduce((a: number, c: any) => a + Number(c.valor_comissao), 0);

        setComissoesMes(totalComissoes);
        setMetricas({ faturamento: entradas, despesas: saidas, lucro: entradas - saidas, ticketMedio: ticket, totalAtendimentos: totalAgs, sa, topServicos: top5 });
      } catch (err) {
        if (process.env.NODE_ENV === 'development') console.error('[AbaDashboard] Erro ao carregar métricas:', err);
      }
      setCarregando(false);
    }
    carregarDados();
  }, [perfil]);

  if (carregando) return (
    <div className="flex h-full items-center justify-center font-title uppercase tracking-widest font-bold text-sm" style={{ color: C.textLight }}>
      A carregar métricas da operação... ⏳
    </div>
  );

  const podeVerRelatorios = temPermissao(perfil, 'modulo.relatorios');
  const podeVerFinanceiro = temPermissao(perfil, 'modulo.financeiro');

  const atalhos = [
    { id: 'agenda',     icon: FiCalendar,   label: 'Abrir Agenda',     bloqueado: false },
    { id: 'financeiro', icon: FiDollarSign,  label: 'Ver Financeiro',   bloqueado: !podeVerFinanceiro },
    { id: 'crm',        icon: FiUsers,       label: 'CRM de Clientes',  bloqueado: false },
    { id: 'relatorios', icon: FiBarChart2,   label: 'Inteligência',     bloqueado: !podeVerRelatorios },
  ];

  return (
    <div className="flex-1 p-8 overflow-y-auto font-body" style={{ background: C.bg }}>

      <ModalBoasVindas nomeUsuario={perfil?.nome} onNavegar={setAba} />

      {/* CABEÇALHO */}
      <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 className="m-0 font-title text-base font-bold uppercase tracking-widest" style={{ color: C.sidebarBg }}>
            Visão Geral do Negócio
          </h2>
          <p className="m-0 mt-1.5 text-xs font-medium uppercase tracking-wider" style={{ color: C.textLight }}>
            Resultados consolidados de {new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button
          onClick={() => setAba && setAba('relatorios')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, background: C.bgCard, color: C.textMain, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          title="Abrir Comparativo de Períodos em Inteligência"
        >
          <FiBarChart2 size={14} /> Comparar Meses
        </button>
      </div>

      {/* PAINEL DE METAS */}
      <div style={{ marginBottom: 24 }}>
        <PainelMetas
          perfil={perfil}
          faturamentoMes={metricas.faturamento}
          despesasMes={metricas.despesas}
          comissoesMes={comissoesMes}
        />
      </div>

      {/* SEÇÃO INFERIOR */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="flex flex-col gap-6">

          {/* Ticket Médio */}
          <Card className="p-6 bg-white rounded-xl shadow-sm border transition-transform hover:scale-[1.01]" style={{ borderColor: C.border }}>
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-lg flex items-center justify-center" style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.sidebarBg }}>
                <FiCreditCard size={18} />
              </div>
              <div>
                <p className="m-0 font-title text-[10px] font-bold uppercase tracking-wider" style={{ color: C.textMuted }}>Ticket Médio Mensal</p>
                <h4 className="m-0 mt-1 text-lg font-title font-bold" style={{ color: C.sidebarBg }}>{brl(metricas.ticketMedio)}</h4>
                <p className="m-0 mt-0.5 text-xs text-zinc-400 font-medium">Faturamento médio por atendimento concluído.</p>
              </div>
            </div>
          </Card>

          {/* Atendimentos + SA */}
          <Card className="p-6 bg-white rounded-xl shadow-sm border transition-transform hover:scale-[1.01]" style={{ borderColor: C.border }}>
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-lg flex items-center justify-center" style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.sidebarBg }}>
                <FiActivity size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <p className="m-0 font-title text-[10px] font-bold uppercase tracking-wider" style={{ color: C.textMuted }}>Atendimentos Finalizados</p>
                <h4 className="m-0 mt-1 text-lg font-title font-bold" style={{ color: C.sidebarBg }}>
                  {metricas.totalAtendimentos}
                  <span className="text-xs uppercase tracking-wider font-medium ml-1" style={{ color: C.textLight }}>procedimentos</span>
                </h4>
              </div>
            </div>

            {/* SA */}
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: RAIO_SM, background: `${C.sidebarBg}12`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FiScissors size={13} color={C.sidebarBg} />
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>SA — Serv. por Cliente</p>
                  <p style={{ margin: 0, fontSize: 11, color: C.textLight, lineHeight: 1.3 }}>Média de serviços por cliente atendido no mês</p>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: C.sidebarBg }}>{metricas.sa.toFixed(2)}</span>
                <span style={{ fontSize: 10, color: C.textLight, display: 'block' }}>serv./cliente</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Ranking de Serviços */}
        <Card className="p-6 bg-white rounded-xl shadow-sm border" style={{ borderColor: C.border }}>
          <h3 className="m-0 mb-6 text-xs font-title font-bold uppercase tracking-widest" style={{ color: C.sidebarBg, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FiLayers size={14} color={C.textLight} /> Ranking de Serviços
          </h3>
          {metricas.topServicos.length === 0 ? (
            <p className="font-medium text-xs text-zinc-400 italic">Nenhum procedimento finalizado no período atual.</p>
          ) : (
            <div className="flex flex-col gap-5">
              {metricas.topServicos.map((item, index) => {
                const max = metricas.topServicos[0].quantidade;
                const percent = (item.quantidade / max) * 100;
                const barColor = index === 0 ? C.douradoLuarys : C.btnPrimary;
                return (
                  <div key={item.nome}>
                    <div className="flex justify-between text-xs font-semibold mb-1.5" style={{ color: C.textMain }}>
                      <span style={{ fontWeight: index === 0 ? 600 : 500 }}>
                        <span className="font-title text-[10px] text-zinc-400 mr-1">{index + 1}º</span>
                        {item.nome}
                      </span>
                      <span className="font-title text-[10px]" style={{ color: C.textMuted }}>{item.quantidade} u.</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: C.bg }}>
                      <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${percent}%`, background: barColor }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>


      {/* ATALHOS */}
      {setAba && (
        <div>
          <h3 className="m-0 mb-4 font-title text-[10px] font-bold uppercase tracking-widest" style={{ color: C.textMuted }}>Acesso Rápido</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {atalhos.map(({ id, icon: Icon, label, bloqueado }) => (
              <button
                key={id}
                onClick={() => !bloqueado && setAba(id)}
                disabled={bloqueado}
                title={bloqueado ? 'Sem permissão de acesso' : label}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                  padding: '20px 12px', borderRadius: RAIO_XL, transition: 'all 0.2s',
                  fontWeight: 700, fontSize: 12, position: 'relative',
                  background: bloqueado ? C.bg : C.bgCard,
                  border: `1px solid ${bloqueado ? C.border : C.border}`,
                  color: bloqueado ? C.textLight : C.sidebarBg,
                  cursor: bloqueado ? 'not-allowed' : 'pointer',
                  opacity: bloqueado ? 0.55 : 1,
                }}
                onMouseEnter={e => { if (!bloqueado) e.currentTarget.style.borderColor = C.activeMenuBg; }}
                onMouseLeave={e => { if (!bloqueado) e.currentTarget.style.borderColor = C.border; }}
              >
                <Icon size={22} />
                <span className="font-title uppercase tracking-wider text-[10px]">{label}</span>
                {bloqueado && (
                  <span style={{
                    position: 'absolute', top: 8, right: 8,
                    fontSize: 9, fontWeight: 800, color: C.textLight,
                    background: C.border, padding: '2px 6px', borderRadius: 99,
                    fontFamily: 'var(--font-title)', textTransform: 'uppercase', letterSpacing: '0.5px',
                  }}>
                    bloqueado
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

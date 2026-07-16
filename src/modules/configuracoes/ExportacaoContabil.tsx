'use client'
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { C, brl } from "@/lib/constants";
import { RAIO_MD, RAIO_LG, RAIO_XL } from "@/lib/estiloGlobal";
import { useToast } from "@/components/Toast";
import {
  FiDownload, FiFileText, FiCalendar, FiTrendingUp,
  FiTrendingDown, FiUsers, FiPackage, FiMail, FiSave,
} from "react-icons/fi";

// ── helpers ────────────────────────────────────────────────────────────────

function fmtData(iso: string | null) {
  if (!iso) return '';
  return new Date(iso.includes('T') ? iso : iso + 'T12:00:00').toLocaleDateString('pt-BR');
}

function fmtValor(v: any) {
  return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

function downloadCSV(nome: string, cabecalho: string[], linhas: (string | number | null)[]) {
  const bom = '﻿';
  const cols = [cabecalho, ...linhas as any];
  const conteudo = bom + cols.map((r: any[]) =>
    r.map((c: any) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')
  ).join('\n');
  const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

function mesLabel(mes: string) {
  if (!mes) return '';
  const [ano, m] = mes.split('-');
  return `${m}-${ano}`;
}

// ── busca de dados ─────────────────────────────────────────────────────────

async function buscarFaturamento(salaoId: string, inicio: string, fim: string) {
  const { data } = await supabase
    .from('financeiro')
    .select('os_numero,cliente_nome,descricao,profissional_nome,forma_pagamento,bandeira_cartao,valor,status,data_movimentacao,categoria,tipo')
    .eq('salao_id', salaoId)
    .eq('tipo', 'entrada')
    .neq('status', 'Estornado')
    .gte('data_movimentacao', inicio)
    .lte('data_movimentacao', fim)
    .order('data_movimentacao');
  return data || [];
}

async function buscarDespesas(salaoId: string, inicio: string, fim: string) {
  const { data: dVenc } = await supabase
    .from('despesas')
    .select('descricao,categoria,tipo_custo,valor,data_vencimento,data_pagamento,forma_pagamento,status,observacao')
    .eq('salao_id', salaoId)
    .gte('data_vencimento', inicio.split('T')[0])
    .lte('data_vencimento', fim.split('T')[0]);
  const { data: dPago } = await supabase
    .from('despesas')
    .select('descricao,categoria,tipo_custo,valor,data_vencimento,data_pagamento,forma_pagamento,status,observacao')
    .eq('salao_id', salaoId)
    .gte('data_pagamento', inicio.split('T')[0])
    .lte('data_pagamento', fim.split('T')[0]);
  // deduplica por descricao+valor+data (sem id disponível aqui)
  const mapa = new Map<string, any>();
  [...(dVenc || []), ...(dPago || [])].forEach(d => {
    const chave = `${d.descricao}|${d.valor}|${d.data_vencimento}`;
    mapa.set(chave, d);
  });
  return Array.from(mapa.values());
}

async function buscarComissoes(salaoId: string, inicio: string, fim: string) {
  const { data } = await supabase
    .from('comissoes')
    // Competência = data do serviço (data_evento), não o dia do fechamento.
    .select('servico_nome,valor_servico,porcentagem_comissao,valor_comissao,status,created_at,data_evento,profissionais(nome),agendamentos(cliente_nome)')
    .eq('salao_id', salaoId)
    .gte('data_evento', inicio)
    .lte('data_evento', fim)
    .order('data_evento');
  return data || [];
}

// ── linhas CSV por tipo ────────────────────────────────────────────────────

const CAB_FAT   = ['Data','OS','Cliente','Descrição','Profissional','Forma Pgto','Bandeira','Valor (R$)','Status'];
const CAB_DESP  = ['Vencimento','Pagamento','Descrição','Categoria','Tipo','Forma Pgto','Valor (R$)','Status'];
const CAB_COM   = ['Data','Profissional','Cliente','Serviço','% Comissão','Valor Serviço (R$)','Comissão (R$)','Status'];

function linhasFat(rows: any[]) {
  return rows.map(r => [
    fmtData(r.data_movimentacao), r.os_numero || '', r.cliente_nome || '',
    r.descricao || '', r.profissional_nome || '',
    r.forma_pagamento || '', r.bandeira_cartao || '',
    fmtValor(r.valor), r.status || '',
  ]);
}

function linhasDesp(rows: any[]) {
  return rows.map(r => [
    fmtData(r.data_vencimento), fmtData(r.data_pagamento),
    r.descricao || '', r.categoria || '', r.tipo_custo || '',
    r.forma_pagamento || '', fmtValor(r.valor), r.status || '',
  ]);
}

function linhasCom(rows: any[]) {
  return rows.map(r => [
    fmtData(r.created_at),
    (r.profissionais as any)?.nome || '',
    (r.agendamentos as any)?.cliente_nome || '',
    r.servico_nome || '',
    `${Number(r.porcentagem_comissao || 0).toFixed(0)}%`,
    fmtValor(r.valor_servico),
    fmtValor(r.valor_comissao),
    r.status || '',
  ]);
}

// ── componente ─────────────────────────────────────────────────────────────

const inp = {
  padding: '10px 14px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`,
  outlineColor: C.sidebarBg, fontSize: 13, color: C.textMain,
  backgroundColor: '#fff', width: '100%', boxSizing: 'border-box' as const,
};
const lbl = { margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: C.textMuted, display: 'block' as const };

export function ExportacaoContabil({ perfil }: { perfil?: any }) {
  const toast = useToast();
  const [mes, setMes] = useState('');
  const [carregando, setCarregando] = useState<string | null>(null);
  const [emailContador, setEmailContador] = useState('');
  const [salvandoEmail, setSalvandoEmail] = useState(false);

  useEffect(() => {
    if (!perfil?.salao_id) return;
    supabase.from('saloes').select('email_contador').eq('id', perfil.salao_id).maybeSingle()
      .then(({ data }) => { if (data?.email_contador) setEmailContador(data.email_contador); });
  }, [perfil?.salao_id]);

  async function salvarEmailContador() {
    if (!perfil?.salao_id) return;
    if (emailContador && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailContador)) {
      toast.aviso('E-mail inválido.'); return;
    }
    setSalvandoEmail(true);
    const { error } = await supabase.from('saloes')
      .update({ email_contador: emailContador || null })
      .eq('id', perfil.salao_id);
    setSalvandoEmail(false);
    if (error) toast.erro('Erro ao salvar: ' + error.message);
    else toast.sucesso('E-mail do contador salvo!');
  }

  async function enviarParaContador() {
    if (!mes || !perfil?.salao_id) { toast.aviso('Selecione o mês de referência.'); return; }
    if (!emailContador) { toast.aviso('Configure o e-mail do contador primeiro.'); return; }
    setCarregando('enviar');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/enviar-relatorio-contabil`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ salao_id: perfil.salao_id, mes }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao enviar.');
      toast.sucesso(`Relatório enviado para ${emailContador}! (${json.registros} registros)`);
    } catch (e: any) {
      toast.erro(e.message);
    } finally {
      setCarregando(null);
    }
  }

  function rangeDoMes(mesAno: string) {
    const [ano, m] = mesAno.split('-').map(Number);
    const inicio = new Date(ano, m - 1, 1);
    const fim    = new Date(ano, m, 0, 23, 59, 59, 999);
    return {
      inicio: inicio.toISOString(),
      fim:    fim.toISOString(),
    };
  }

  async function baixarFaturamento() {
    if (!mes || !perfil?.salao_id) { toast.aviso('Selecione o mês de referência.'); return; }
    setCarregando('fat');
    try {
      const { inicio, fim } = rangeDoMes(mes);
      const rows = await buscarFaturamento(perfil.salao_id, inicio, fim);
      if (!rows.length) { toast.aviso('Nenhum faturamento encontrado no período.'); return; }
      downloadCSV(`faturamento_${mesLabel(mes)}.csv`, CAB_FAT, linhasFat(rows) as any);
      toast.sucesso(`${rows.length} registros exportados.`);
    } catch { toast.erro('Erro ao gerar relatório.'); }
    finally { setCarregando(null); }
  }

  async function baixarDespesas() {
    if (!mes || !perfil?.salao_id) { toast.aviso('Selecione o mês de referência.'); return; }
    setCarregando('desp');
    try {
      const { inicio, fim } = rangeDoMes(mes);
      const rows = await buscarDespesas(perfil.salao_id, inicio, fim);
      if (!rows.length) { toast.aviso('Nenhuma despesa encontrada no período.'); return; }
      downloadCSV(`despesas_${mesLabel(mes)}.csv`, CAB_DESP, linhasDesp(rows) as any);
      toast.sucesso(`${rows.length} registros exportados.`);
    } catch { toast.erro('Erro ao gerar relatório.'); }
    finally { setCarregando(null); }
  }

  async function baixarComissoes() {
    if (!mes || !perfil?.salao_id) { toast.aviso('Selecione o mês de referência.'); return; }
    setCarregando('com');
    try {
      const { inicio, fim } = rangeDoMes(mes);
      const rows = await buscarComissoes(perfil.salao_id, inicio, fim);
      if (!rows.length) { toast.aviso('Nenhuma comissão encontrada no período.'); return; }
      downloadCSV(`comissoes_${mesLabel(mes)}.csv`, CAB_COM, linhasCom(rows) as any);
      toast.sucesso(`${rows.length} registros exportados.`);
    } catch { toast.erro('Erro ao gerar relatório.'); }
    finally { setCarregando(null); }
  }

  async function baixarTodos() {
    if (!mes || !perfil?.salao_id) { toast.aviso('Selecione o mês de referência.'); return; }
    setCarregando('todos');
    try {
      const { inicio, fim } = rangeDoMes(mes);
      const [fat, desp, com] = await Promise.all([
        buscarFaturamento(perfil.salao_id, inicio, fim),
        buscarDespesas(perfil.salao_id, inicio, fim),
        buscarComissoes(perfil.salao_id, inicio, fim),
      ]);

      const sepFat  = [``, `=== FATURAMENTO (${fat.length} registros) ===`];
      const sepDesp = [``, `=== DESPESAS (${desp.length} registros) ===`];
      const sepCom  = [``, `=== COMISSÕES (${com.length} registros) ===`];

      const bom = '﻿';
      const toRow = (cells: any[]) => cells.map((c: any) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';');
      const blocos = [
        sepFat.map(s => `"${s}"`).join(''), toRow(CAB_FAT), ...linhasFat(fat).map(toRow),
        '', sepDesp.map(s => `"${s}"`).join(''), toRow(CAB_DESP), ...linhasDesp(desp).map(toRow),
        '', sepCom.map(s => `"${s}"`).join(''), toRow(CAB_COM), ...linhasCom(com).map(toRow),
      ];
      const blob = new Blob([bom + blocos.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `contabilidade_${mesLabel(mes)}.csv`; a.click();
      URL.revokeObjectURL(url);
      toast.sucesso(`Relatório consolidado gerado: ${fat.length + desp.length + com.length} registros.`);
    } catch { toast.erro('Erro ao gerar relatório consolidado.'); }
    finally { setCarregando(null); }
  }

  const CARDS = [
    {
      chave: 'fat', icone: <FiTrendingUp size={22} />, cor: '#10B981', bgCor: '#F0FDF4',
      titulo: 'Faturamento', sub: 'Entradas do período (serviços prestados)',
      acao: baixarFaturamento,
    },
    {
      chave: 'desp', icone: <FiTrendingDown size={22} />, cor: '#EF4444', bgCor: '#FEF2F2',
      titulo: 'Despesas', sub: 'Custos fixos e variáveis pagos no período',
      acao: baixarDespesas,
    },
    {
      chave: 'com', icone: <FiUsers size={22} />, cor: C.sidebarBg, bgCor: `${C.sidebarBg}10`,
      titulo: 'Comissões da Equipe', sub: 'Comissões geradas e seu status de pagamento',
      acao: baixarComissoes,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* CABEÇALHO */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 20, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ width: 48, height: 48, borderRadius: RAIO_LG, background: C.bg, color: C.sidebarBg, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${C.border}` }}>
          <FiFileText size={24} />
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.sidebarBg }}>Exportação Contábil</h3>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: C.textMuted }}>Relatórios em CSV prontos para importar no Excel ou enviar ao contador.</p>
        </div>
      </div>

      {/* E-MAIL DO CONTADOR */}
      <div style={{ background: C.bgCard, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, padding: 24 }}>
        <p style={{ ...lbl, marginBottom: 12, fontSize: 12 }}>
          <FiMail size={12} style={{ marginRight: 6 }} />E-mail do Escritório de Contabilidade
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            type="email"
            placeholder="contador@escritorio.com.br"
            style={{ ...inp, flex: 1 }}
            value={emailContador}
            onChange={e => setEmailContador(e.target.value)}
          />
          <button
            onClick={salvarEmailContador}
            disabled={salvandoEmail}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: C.sidebarBg, color: '#fff', border: 'none', borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: salvandoEmail ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
          >
            <FiSave size={14} />{salvandoEmail ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
        {emailContador && (
          <p style={{ margin: '8px 0 0', fontSize: 11, color: C.textMuted }}>
            Os relatórios serão enviados para <strong>{emailContador}</strong>
          </p>
        )}
      </div>

      {/* FILTRO DE MÊS */}
      <div style={{ background: C.bgCard, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, padding: 24 }}>
        <div style={{ maxWidth: 280 }}>
          <label style={lbl}><FiCalendar size={11} style={{ marginRight: 4 }} />Competência (Mês / Ano)</label>
          <input type="month" style={inp} value={mes} onChange={e => setMes(e.target.value)} />
        </div>
      </div>

      {/* CARDS INDIVIDUAIS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        {CARDS.map(card => (
          <div key={card.chave} style={{ background: C.bgCard, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
            <div style={{ background: card.bgCor, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: `1px solid ${C.border}` }}>
              <div style={{ color: card.cor }}>{card.icone}</div>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: card.cor }}>{card.titulo}</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: C.textMuted }}>{card.sub}</p>
              </div>
            </div>
            <div style={{ padding: '16px 20px' }}>
              <button
                onClick={card.acao}
                disabled={!!carregando}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 16px', background: carregando === card.chave ? C.borderMid : card.cor, color: '#fff', border: 'none', borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: carregando ? 'not-allowed' : 'pointer', transition: '0.15s' }}
              >
                <FiDownload size={14} />
                {carregando === card.chave ? 'Gerando...' : `Baixar ${card.titulo}`}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* CONSOLIDADO + ENVIO */}
      <div style={{ background: C.sidebarBg, borderRadius: RAIO_XL, padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#fff' }}>Relatório Consolidado</p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
            {emailContador
              ? `Enviar para ${emailContador} ou baixar localmente.`
              : 'Baixar localmente ou configure o e-mail do contador para enviar direto.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={baixarTodos}
            disabled={!!carregando}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: RAIO_MD, fontSize: 13, fontWeight: 700, cursor: carregando ? 'not-allowed' : 'pointer', opacity: carregando ? 0.6 : 1, whiteSpace: 'nowrap' }}
          >
            <FiPackage size={15} />
            {carregando === 'todos' ? 'Compilando...' : 'Baixar Todos'}
          </button>
          {emailContador && (
            <button
              onClick={enviarParaContador}
              disabled={!!carregando}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', background: '#fff', color: C.sidebarBg, border: 'none', borderRadius: RAIO_MD, fontSize: 13, fontWeight: 800, cursor: carregando ? 'not-allowed' : 'pointer', opacity: carregando ? 0.7 : 1, whiteSpace: 'nowrap' }}
            >
              <FiMail size={15} />
              {carregando === 'enviar' ? 'Enviando...' : 'Enviar para Contador'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

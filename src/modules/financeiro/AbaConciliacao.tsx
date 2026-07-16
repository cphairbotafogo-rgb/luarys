// src/modules/financeiro/AbaConciliacao.tsx
// Conciliação de Cartões — agrupa transações por tipo e bandeira,
// aplicando as taxas de config_taxas (Configurações → Taxas e Parcelamentos).
'use client'
import React, { useMemo, useState } from 'react';
import { useTaxasConfig } from '@/lib/useTaxasConfig';
import { C, brl } from '@/lib/constants';
import { RAIO_MD, RAIO_XL, SOMBRA_SUAVE, badgeStatus } from '@/lib/estiloGlobal';
import {
  FiCreditCard, FiChevronDown, FiChevronRight,
  FiCheckCircle, FiClock, FiAlertCircle,
} from 'react-icons/fi';

// ─── Tipos ──────────────────────────────────────────────────────────────────
interface Transacao {
  id: string;
  data: string;
  cliente: string;
  parcela: string;
  valorBruto: number;
  taxaOperadoraPerc: number;
  taxaAntecipacao: number;
  taxaOpeReais: number;
  valorLiquido: number;
  statusConciliacao: string;
}

interface BandeiraDado {
  bandeira: string;
  valorBruto: number;
  descontoOperadora: number;
  descontoAntecipacao: number;
  valorLiquido: number;
  transacoes: Transacao[];
}

interface GrupoPagamento {
  tipo: string;
  valorBruto: number;
  descontoOperadora: number;
  descontoAntecipacao: number;
  valorLiquido: number;
  bandeiras: Record<string, BandeiraDado>;
}

interface Props {
  transacoes: any[];
  perfil: any;
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const LABEL_TIPO: Record<string, string> = {
  CREDITO: 'Cartão de Crédito',
  DEBITO:  'Cartão de Débito',
};

const COR_TIPO: Record<string, string> = {
  CREDITO: C.sidebarBg,
  DEBITO:  C.success,
};

function fmtData(iso: string) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('pt-BR'); } catch { return '—'; }
}

function classificarTipo(fp: string): 'CREDITO' | 'DEBITO' | null {
  const s = String(fp || '').toUpperCase();
  if (s.includes('CRÉDIT') || s.includes('CREDIT')) return 'CREDITO';
  if (s.includes('DÉBIT')  || s.includes('DEBIT'))  return 'DEBITO';
  return null;
}

// ─── Badge de status ─────────────────────────────────────────────────────────
function BadgeConciliacao({ status }: { status: string }) {
  const ok = status === 'Conciliado';
  return (
    <span style={{ ...badgeStatus(ok ? 'sucesso' : 'aviso'), display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {ok ? <FiCheckCircle size={10} /> : <FiClock size={10} />}
      {status}
    </span>
  );
}

// ─── Linha de transação ──────────────────────────────────────────────────────
function LinhaTransacao({ t }: { t: Transacao }) {
  return (
    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
      <td style={{ padding: '10px 14px', fontSize: 12, color: C.textMuted, whiteSpace: 'nowrap' }}>
        {fmtData(t.data)}
      </td>
      <td style={{ padding: '10px 14px', fontSize: 12, color: C.textMain, maxWidth: 200 }}>
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.cliente}</div>
        {t.parcela && t.parcela !== '1/1' && (
          <div style={{ fontSize: 10, color: C.textLight, marginTop: 1 }}>Parcela {t.parcela}</div>
        )}
      </td>
      <td style={{ padding: '10px 14px', fontSize: 12, color: C.textMain, textAlign: 'right', whiteSpace: 'nowrap' }}>
        {brl(t.valorBruto)}
      </td>
      <td style={{ padding: '10px 14px', fontSize: 12, textAlign: 'right', whiteSpace: 'nowrap' }}>
        {t.taxaOpeReais > 0
          ? <><span style={{ color: C.danger }}>{`−${brl(t.taxaOpeReais)}`}</span><br /><span style={{ fontSize: 10, color: C.textLight }}>({t.taxaOperadoraPerc.toFixed(2).replace('.', ',')}%)</span></>
          : <span style={{ color: C.textLight }}>—</span>}
      </td>
      <td style={{ padding: '10px 14px', fontSize: 12, color: C.danger, textAlign: 'right', whiteSpace: 'nowrap' }}>
        {t.taxaAntecipacao > 0 ? `−${brl(t.taxaAntecipacao)}` : <span style={{ color: C.textLight }}>—</span>}
      </td>
      <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 700, color: C.success, textAlign: 'right', whiteSpace: 'nowrap' }}>
        {brl(t.valorLiquido)}
      </td>
      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
        <BadgeConciliacao status={t.statusConciliacao} />
      </td>
    </tr>
  );
}

// ─── Bloco por bandeira ──────────────────────────────────────────────────────
function BlocoBandeira({ bandeira }: { bandeira: BandeiraDado }) {
  const [aberto, setAberto] = useState(false);
  const total       = bandeira.transacoes.length;
  const conciliados = bandeira.transacoes.filter(t => t.statusConciliacao === 'Conciliado').length;

  return (
    <div style={{ marginBottom: 4 }}>
      <button
        onClick={() => setAberto(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px', background: C.bg, border: `1px solid ${C.border}`,
          borderRadius: aberto ? `${RAIO_MD}px ${RAIO_MD}px 0 0` : RAIO_MD,
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {aberto ? <FiChevronDown size={14} color={C.textMuted} /> : <FiChevronRight size={14} color={C.textMuted} />}
          <span style={{ fontSize: 12, fontWeight: 700, color: C.textMain }}>{bandeira.bandeira}</span>
          <span style={{ fontSize: 10, color: C.textLight }}>
            {total} transaç{total === 1 ? 'ão' : 'ões'} · {conciliados} conciliada{conciliados !== 1 ? 's' : ''}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Bruto</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.textMain }}>{brl(bandeira.valorBruto)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Desc.</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.danger }}>
              −{brl(bandeira.descontoOperadora + bandeira.descontoAntecipacao)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Líquido</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.success }}>{brl(bandeira.valorLiquido)}</div>
          </div>
        </div>
      </button>

      {aberto && (
        <div style={{ border: `1px solid ${C.border}`, borderTop: 'none', borderRadius: `0 0 ${RAIO_MD}px ${RAIO_MD}px`, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: C.bgCard }}>
                {['Data', 'Descrição', 'Valor Bruto', 'Taxa Operadora', 'Taxa Antecip.', 'Valor Líquido', 'Status'].map(h => (
                  <th key={h} style={{
                    padding: '8px 14px', fontSize: 10, fontWeight: 700, color: C.textMuted,
                    textTransform: 'uppercase', letterSpacing: '0.5px',
                    textAlign: h === 'Descrição' ? 'left' : h === 'Status' ? 'center' : 'right',
                    borderBottom: `1px solid ${C.border}`,
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bandeira.transacoes.map((t, i) => (
                <LinhaTransacao key={t.id || i} t={t} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Bloco por tipo de cartão ────────────────────────────────────────────────
function BlocoTipo({ grupo }: { grupo: GrupoPagamento }) {
  const [expandido, setExpandido] = useState(true);
  const label     = LABEL_TIPO[grupo.tipo] || grupo.tipo;
  const cor       = COR_TIPO[grupo.tipo] || C.textMuted;
  const bandeiras = Object.values(grupo.bandeiras);
  const totalTx       = bandeiras.reduce((s, b) => s + b.transacoes.length, 0);
  const conciliadosTx = bandeiras.reduce((s, b) => s + b.transacoes.filter(t => t.statusConciliacao === 'Conciliado').length, 0);

  return (
    <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, boxShadow: SOMBRA_SUAVE, overflow: 'hidden' }}>
      <button
        onClick={() => setExpandido(v => !v)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: cor, borderRadius: RAIO_MD, padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FiCreditCard size={16} color="#fff" />
          </div>
          <div>
            <div className="font-title" style={{ fontSize: 14, fontWeight: 700, color: C.textMain }}>{label}</div>
            <div style={{ fontSize: 11, color: C.textLight, marginTop: 2 }}>
              {totalTx} transaç{totalTx === 1 ? 'ão' : 'ões'} · {conciliadosTx} conciliada{conciliadosTx !== 1 ? 's' : ''} · {bandeiras.length} bandeira{bandeiras.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Bruto</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.textMain }}>{brl(grupo.valorBruto)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Descontos</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.danger }}>
              −{brl(grupo.descontoOperadora + grupo.descontoAntecipacao)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Líquido</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.success }}>{brl(grupo.valorLiquido)}</div>
          </div>
          <div style={{ color: C.textLight }}>
            {expandido ? <FiChevronDown size={18} /> : <FiChevronRight size={18} />}
          </div>
        </div>
      </button>

      {expandido && (
        <div style={{ padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: 6, borderTop: `1px solid ${C.border}` }}>
          {bandeiras.length === 0
            ? <p style={{ fontSize: 12, color: C.textLight, textAlign: 'center', padding: 16 }}>Nenhuma transação neste grupo.</p>
            : bandeiras.map(b => <BlocoBandeira key={b.bandeira} bandeira={b} />)}
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────
export function AbaConciliacao({ transacoes, perfil }: Props) {
  const { obterTaxa, configCarregada } = useTaxasConfig(perfil);

  const grupos = useMemo<Record<string, GrupoPagamento>>(() => {
    const g: Record<string, GrupoPagamento> = {};
    const entradas = transacoes.filter(
      t => t.tipo === 'entrada' && t.status !== 'Pendente' && t.status !== 'Estornado'
    );

    entradas.forEach(item => {
      const tipo = classificarTipo(item.forma_pagamento);
      if (!tipo) return;

      const valorBruto        = parseFloat(item.valor) || 0;
      const band              = item.bandeira_cartao || null;
      const formaStr          = tipo === 'DEBITO' ? 'Cartão de Débito' : 'Cartão de Crédito';
      const taxaOperadoraPerc = obterTaxa(formaStr, band);
      const taxaAntecipacao   = parseFloat(item.taxa_antecipacao) || 0;
      const taxaOpeReais      = valorBruto * (taxaOperadoraPerc / 100);
      const valorLiquido      = valorBruto - taxaOpeReais - taxaAntecipacao;
      const statusConciliacao = ['Pago', 'Recebido', 'Conciliado'].includes(item.status)
        ? 'Conciliado' : 'Pendente';
      const labelBandeira     = band || 'Sem bandeira';

      if (!g[tipo]) {
        g[tipo] = { tipo, valorBruto: 0, descontoOperadora: 0, descontoAntecipacao: 0, valorLiquido: 0, bandeiras: {} };
      }
      g[tipo].valorBruto          += valorBruto;
      g[tipo].descontoOperadora   += taxaOpeReais;
      g[tipo].descontoAntecipacao += taxaAntecipacao;
      g[tipo].valorLiquido        += valorLiquido;

      if (!g[tipo].bandeiras[labelBandeira]) {
        g[tipo].bandeiras[labelBandeira] = {
          bandeira: labelBandeira, valorBruto: 0,
          descontoOperadora: 0, descontoAntecipacao: 0, valorLiquido: 0, transacoes: [],
        };
      }
      const bd = g[tipo].bandeiras[labelBandeira];
      bd.valorBruto          += valorBruto;
      bd.descontoOperadora   += taxaOpeReais;
      bd.descontoAntecipacao += taxaAntecipacao;
      bd.valorLiquido        += valorLiquido;
      bd.transacoes.push({
        id: item.id,
        data: item.data_movimentacao || item.created_at,
        cliente: item.descricao || 'Entrada',
        parcela: item.parcelas || '1/1',
        valorBruto, taxaOperadoraPerc, taxaAntecipacao, taxaOpeReais, valorLiquido, statusConciliacao,
      });
    });

    Object.values(g).forEach(gr =>
      Object.values(gr.bandeiras).forEach(b =>
        b.transacoes.sort((a, z) => new Date(z.data).getTime() - new Date(a.data).getTime())
      )
    );

    return g;
  }, [transacoes, obterTaxa]);

  const listaGrupos = Object.values(grupos);

  const totalBruto = listaGrupos.reduce((s, g) => s + g.valorBruto, 0);
  const totalDesc  = listaGrupos.reduce((s, g) => s + g.descontoOperadora + g.descontoAntecipacao, 0);
  const totalLiq   = listaGrupos.reduce((s, g) => s + g.valorLiquido, 0);

  const todasTrans     = listaGrupos.flatMap(g => Object.values(g.bandeiras).flatMap(b => b.transacoes));
  const qtdTotal       = todasTrans.length;
  const qtdConciliados = todasTrans.filter(t => t.statusConciliacao === 'Conciliado').length;
  const qtdPendentes   = qtdTotal - qtdConciliados;

  if (listaGrupos.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 64, gap: 16 }}>
        <FiAlertCircle size={40} color={C.textLight} />
        <p className="font-title" style={{ color: C.textLight, fontSize: 14, fontWeight: 700, textAlign: 'center' }}>
          Nenhuma transação de cartão encontrada no período.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Aviso taxas não configuradas */}
      {!configCarregada && (
        <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: RAIO_MD, padding: '10px 16px', fontSize: 12, color: '#92400E', fontWeight: 600 }}>
          ⚠️ Taxas de cartão não encontradas — configure em <strong>Configurações → Taxas de Cartão</strong>.
        </div>
      )}

      {/* ── Resumo geral ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, padding: '18px 20px', boxShadow: SOMBRA_SUAVE }}>
          <div className="font-title" style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Total Bruto</div>
          <div className="font-title" style={{ fontSize: 22, fontWeight: 800, color: C.textMain }}>{brl(totalBruto)}</div>
          <div style={{ fontSize: 11, color: C.textLight, marginTop: 4 }}>{qtdTotal} transaç{qtdTotal === 1 ? 'ão' : 'ões'}</div>
        </div>

        <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderTop: `3px solid ${C.danger}`, borderRadius: RAIO_XL, padding: '18px 20px', boxShadow: SOMBRA_SUAVE }}>
          <div className="font-title" style={{ fontSize: 10, fontWeight: 700, color: C.danger, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Total Descontos</div>
          <div className="font-title" style={{ fontSize: 22, fontWeight: 800, color: C.danger }}>−{brl(totalDesc)}</div>
          <div style={{ fontSize: 11, color: C.textLight, marginTop: 4 }}>
            {configCarregada ? 'Taxa operadora + antecipação' : 'Configure as taxas para calcular'}
          </div>
        </div>

        <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderTop: `3px solid ${C.success}`, borderRadius: RAIO_XL, padding: '18px 20px', boxShadow: SOMBRA_SUAVE }}>
          <div className="font-title" style={{ fontSize: 10, fontWeight: 700, color: C.success, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Líquido Estimado</div>
          <div className="font-title" style={{ fontSize: 22, fontWeight: 800, color: C.success }}>{brl(totalLiq)}</div>
          <div style={{ fontSize: 11, color: C.textLight, marginTop: 4 }}>Após todos os descontos</div>
        </div>

        <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderTop: `3px solid ${C.douradoEleva}`, borderRadius: RAIO_XL, padding: '18px 20px', boxShadow: SOMBRA_SUAVE }}>
          <div className="font-title" style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Status</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <div>
              <div className="font-title" style={{ fontSize: 20, fontWeight: 800, color: C.success }}>{qtdConciliados}</div>
              <div style={{ fontSize: 10, color: C.textLight }}>Conciliado{qtdConciliados !== 1 ? 's' : ''}</div>
            </div>
            <div style={{ fontSize: 18, color: C.border, marginBottom: 2 }}>/</div>
            <div>
              <div className="font-title" style={{ fontSize: 20, fontWeight: 800, color: qtdPendentes > 0 ? C.warning : C.textLight }}>{qtdPendentes}</div>
              <div style={{ fontSize: 10, color: C.textLight }}>Pendente{qtdPendentes !== 1 ? 's' : ''}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Grupos por tipo de cartão ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {listaGrupos.map(g => <BlocoTipo key={g.tipo} grupo={g} />)}
      </div>

    </div>
  );
}

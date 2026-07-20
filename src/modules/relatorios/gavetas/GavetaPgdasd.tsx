'use client'

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { C, brl } from '@/lib/constants';
import { RAIO_MD, RAIO_XL, RAIO_XS } from '@/lib/estiloGlobal';
import { FiInfo, FiLoader, FiCheckCircle } from 'react-icons/fi';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface LinhaMes {
  mes: number;             // 1..12
  totalFaturado: number;   // valor total das notas (cota salão + cota prof)
  cotasCnpj: number;       // cotas de parceiros com CNPJ → deduzir
  cotasCpf: number;        // cotas de parceiros sem CNPJ → permanecem na receita
  cotaSalao: number;       // parte certa do salão
  receita: number;         // receita bruta declarável = totalFaturado - cotasCnpj
}

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(parte: number, total: number) {
  if (!total) return '—';
  return `${((parte / total) * 100).toFixed(1)}%`;
}

function Th({ children, align = 'right' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th style={{ padding: '10px 14px', textAlign: align, fontSize: 11, fontWeight: 700,
      color: C.textMuted, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>
      {children}
    </th>
  );
}

function Td({ children, bold, color, align = 'right' }: {
  children: React.ReactNode; bold?: boolean; color?: string; align?: 'left' | 'right'
}) {
  return (
    <td style={{ padding: '10px 14px', textAlign: align, fontSize: 13,
      fontWeight: bold ? 700 : 400, color: color || C.textMain, borderBottom: `1px solid ${C.border}` }}>
      {children}
    </td>
  );
}

// ─── Barra proporcional ────────────────────────────────────────────────────────

function BarraProporcional({ salao, cnpj, cpf, total }: {
  salao: number; cnpj: number; cpf: number; total: number
}) {
  if (!total) return null;
  const pSalao = (salao / total) * 100;
  const pCnpj  = (cnpj  / total) * 100;
  const pCpf   = (cpf   / total) * 100;
  return (
    <div style={{ display: 'flex', height: 6, borderRadius: RAIO_XS, overflow: 'hidden', background: C.border }}>
      <div title={`Salão: ${pct(salao, total)}`}
        style={{ width: `${pSalao}%`, background: '#3B82F6', transition: 'width 0.3s' }} />
      <div title={`Cota CPF: ${pct(cpf, total)}`}
        style={{ width: `${pCpf}%`, background: '#F59E0B', transition: 'width 0.3s' }} />
      <div title={`Cota CNPJ (deduz): ${pct(cnpj, total)}`}
        style={{ width: `${pCnpj}%`, background: '#22C55E', transition: 'width 0.3s' }} />
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function GavetaPgdasd({ perfil }: { perfil: any }) {
  const anoAtual = new Date().getFullYear();
  const [ano, setAno]           = useState(anoAtual);
  const [rows, setRows]         = useState<any[]>([]);
  const [carregando, setCarregando] = useState(false);

  async function buscar() {
    if (!perfil?.salao_id) return;
    setCarregando(true);
    const { data } = await supabase
      .from('notas_fiscais')
      .select('data_movimentacao, valor, valor_cota_salao, valor_cota_profissional, tipo_parceiro')
      .eq('salao_id', perfil.salao_id)
      .gte('data_movimentacao', `${ano}-01-01T00:00:00Z`)
      .lte('data_movimentacao', `${ano}-12-31T23:59:59Z`);
    setRows(data || []);
    setCarregando(false);
  }

  useEffect(() => { buscar(); }, [perfil?.salao_id, ano]);

  const linhas = useMemo<LinhaMes[]>(() => {
    const mp: Record<number, LinhaMes> = {};
    for (let m = 1; m <= 12; m++) {
      mp[m] = { mes: m, totalFaturado: 0, cotasCnpj: 0, cotasCpf: 0, cotaSalao: 0, receita: 0 };
    }
    for (const r of rows) {
      const m = new Date(r.data_movimentacao).getMonth() + 1;
      const total    = Number(r.valor)                   || 0;
      const cotaProf = Number(r.valor_cota_profissional) || 0;
      const cotaSal  = Number(r.valor_cota_salao)        || 0;
      mp[m].totalFaturado += total;
      mp[m].cotaSalao     += cotaSal;
      if (r.tipo_parceiro === 'parceiro_cnpj') mp[m].cotasCnpj += cotaProf;
      else                                      mp[m].cotasCpf  += cotaProf;
    }
    for (const l of Object.values(mp)) {
      l.receita = Math.max(0, l.totalFaturado - l.cotasCnpj);
    }
    return Object.values(mp);
  }, [rows]);

  const totais = useMemo(() => linhas.reduce(
    (acc, l) => ({
      totalFaturado: acc.totalFaturado + l.totalFaturado,
      cotasCnpj:     acc.cotasCnpj     + l.cotasCnpj,
      cotasCpf:      acc.cotasCpf      + l.cotasCpf,
      cotaSalao:     acc.cotaSalao     + l.cotaSalao,
      receita:       acc.receita       + l.receita,
    }),
    { totalFaturado: 0, cotasCnpj: 0, cotasCpf: 0, cotaSalao: 0, receita: 0 }
  ), [linhas]);

  const temDados = rows.length > 0;
  const anos = Array.from({ length: 4 }, (_, i) => anoAtual - i);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Banner explicativo */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: '#EFF6FF',
        border: '1px solid #BFDBFE', borderRadius: RAIO_XL, padding: '14px 18px' }}>
        <FiInfo size={16} color="#1D4ED8" style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: 12, color: '#1E40AF', lineHeight: 1.7 }}>
          <strong>Como usar no PGDAS-D (Resolução CGSN 140/2018).</strong>{' '}
          Preencha o campo <em>"Receita Bruta"</em> com o valor da coluna <strong>Receita Declarável</strong> —
          já excluídas as cotas de profissionais com CNPJ. Cotas de parceiros sem CNPJ (CPF/RPA)
          permanecem na receita bruta. Guarde as notas fiscais recebidas dos parceiros CNPJ como comprovante da dedução.
        </div>
      </div>

      {/* Seletor de ano */}
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL,
        padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: C.textMuted }}>Ano-calendário:</label>
        <select value={ano} onChange={e => setAno(Number(e.target.value))}
          style={{ border: `1px solid ${C.border}`, borderRadius: RAIO_MD, padding: '6px 10px',
            fontSize: 13, color: C.textMain, background: C.bg }}>
          {anos.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <button onClick={buscar}
          style={{ padding: '7px 16px', borderRadius: RAIO_MD, background: C.sidebarBg,
            color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          Atualizar
        </button>
        {carregando && <FiLoader className="animate-spin" size={16} color={C.textMuted} />}
      </div>

      {/* Legenda da barra */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: '0 4px' }}>
        {[
          { cor: '#3B82F6', label: 'Cota do Salão' },
          { cor: '#F59E0B', label: 'Cota CPF (permanece na receita)' },
          { cor: '#22C55E', label: 'Cota CNPJ (deduzida do PGDAS-D)' },
        ].map(({ cor, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: cor }} />
            <span style={{ fontSize: 11, color: C.textMuted }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Tabela */}
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: C.bg }}>
                <Th align="left">Mês</Th>
                <Th>Faturamento Total</Th>
                <Th>Cota CNPJ (−)</Th>
                <Th>Cota CPF</Th>
                <Th>Cota Salão</Th>
                <Th>Receita Declarável</Th>
                <Th align="left">Composição</Th>
              </tr>
            </thead>
            <tbody>
              {linhas.map(l => (
                <tr key={l.mes} style={{ opacity: l.totalFaturado === 0 ? 0.4 : 1 }}>
                  <Td align="left" bold={l.totalFaturado > 0}>{MESES[l.mes - 1]}</Td>
                  <Td>{l.totalFaturado > 0 ? brl(l.totalFaturado) : '—'}</Td>
                  <Td color={l.cotasCnpj > 0 ? '#15803D' : undefined}>
                    {l.cotasCnpj > 0 ? `− ${brl(l.cotasCnpj)}` : '—'}
                  </Td>
                  <Td color={l.cotasCpf > 0 ? '#B45309' : undefined}>
                    {l.cotasCpf > 0 ? brl(l.cotasCpf) : '—'}
                  </Td>
                  <Td>{l.cotaSalao > 0 ? brl(l.cotaSalao) : '—'}</Td>
                  <Td bold color={l.totalFaturado > 0 ? C.textMain : undefined}>
                    {l.totalFaturado > 0 ? brl(l.receita) : '—'}
                  </Td>
                  <td style={{ padding: '10px 14px', minWidth: 120, borderBottom: `1px solid ${C.border}` }}>
                    <BarraProporcional
                      salao={l.cotaSalao} cnpj={l.cotasCnpj} cpf={l.cotasCpf} total={l.totalFaturado}
                    />
                  </td>
                </tr>
              ))}

              {/* Totais */}
              {temDados && (
                <tr style={{ background: C.bg }}>
                  <td style={{ padding: '12px 14px', fontWeight: 800, fontSize: 13, color: C.textMain }}>
                    TOTAL {ano}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: C.textMain, fontSize: 13 }}>
                    {brl(totais.totalFaturado)}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: '#15803D', fontSize: 13 }}>
                    {totais.cotasCnpj > 0 ? `− ${brl(totais.cotasCnpj)}` : '—'}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: '#B45309', fontSize: 13 }}>
                    {totais.cotasCpf > 0 ? brl(totais.cotasCpf) : '—'}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: C.textMain, fontSize: 13 }}>
                    {brl(totais.cotaSalao)}
                  </td>
                  <td colSpan={2} style={{ padding: '12px 14px', textAlign: 'right' }}>
                    <span style={{ background: '#DCFCE7', color: '#166534', borderRadius: RAIO_XS,
                      padding: '4px 12px', fontSize: 14, fontWeight: 800 }}>
                      {brl(totais.receita)}
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Sem dados */}
        {!carregando && !temDados && (
          <div style={{ padding: 40, textAlign: 'center', color: C.textLight }}>
            Nenhuma nota fiscal registrada em {ano}.
            <div style={{ fontSize: 12, marginTop: 6 }}>
              Os valores aparecem automaticamente ao fechar contas com profissionais parceiros.
            </div>
          </div>
        )}
      </div>

      {/* Card de economia fiscal */}
      {temDados && totais.cotasCnpj > 0 && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: '#F0FDF4',
          border: '1px solid #BBF7D0', borderRadius: RAIO_XL, padding: '14px 18px' }}>
          <FiCheckCircle size={16} color="#16A34A" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 13, color: '#166534', lineHeight: 1.7 }}>
            <strong>Dedução total de {brl(totais.cotasCnpj)} em {ano}.</strong>{' '}
            Esse valor foi excluído da sua receita bruta por se tratar de cota-parte de profissionais com CNPJ
            (Resolução CGSN 140/2018). Você declarou <strong>{brl(totais.receita)}</strong> no PGDAS-D
            em vez de <strong>{brl(totais.totalFaturado)}</strong> — uma base tributável{' '}
            <strong>{pct(totais.cotasCnpj, totais.totalFaturado)}</strong> menor.
          </div>
        </div>
      )}
    </div>
  );
}

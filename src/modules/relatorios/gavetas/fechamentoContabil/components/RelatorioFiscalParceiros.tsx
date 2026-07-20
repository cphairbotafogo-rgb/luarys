'use client'

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { C, brl } from '@/lib/constants';
import { RAIO_MD, RAIO_XS } from '@/lib/estiloGlobal';
import { FiAlertTriangle, FiCheckCircle, FiDownload, FiLoader, FiPrinter, FiShield } from 'react-icons/fi';
import { gerarCSV, estiloCard, estiloBtnCSV, MESES } from '../tipos';
import { ModalRpa } from '../../ModalRpa';

const INSS_PERC = 0.11;

interface LinhaParceiro {
  nome: string;
  tipo: string | null;
  cnpj: string | null;
  cotaBruta: number;
  qtd: number;
}

function BadgeTipo({ tipo, cnpj }: { tipo: string | null; cnpj: string | null }) {
  const temCnpj = (cnpj || '').replace(/\D/g, '').length === 14;
  if (tipo === 'parceiro_cnpj' || (!tipo && temCnpj))
    return <span style={{ background: '#DCFCE7', color: '#166534', borderRadius: RAIO_XS, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>CNPJ</span>;
  if (tipo === 'parceiro_cpf' || (!tipo && !temCnpj))
    return <span style={{ background: '#FEF9C3', color: '#854D0E', borderRadius: RAIO_XS, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>CPF / RPA</span>;
  return <span style={{ background: '#F3F4F6', color: C.textMuted, borderRadius: RAIO_XS, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>CLT / PJ</span>;
}

function MiniCard({ label, valor, cor, sub }: { label: string; valor: string; cor: string; sub?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 130, background: C.bg, borderRadius: RAIO_MD,
      borderLeft: `3px solid ${cor}`, padding: '12px 16px' }}>
      <div style={{ fontSize: 10, color: C.textLight, textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: C.textMain }}>{valor}</div>
      {sub && <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

interface Props {
  perfil: any;
  mes: number;   // 0-based (igual ao useDadosFechamento)
  ano: number;
  mesAnoLabel: string;
}

export function RelatorioFiscalParceiros({ perfil, mes, ano, mesAnoLabel }: Props) {
  const [linhas, setLinhas]         = useState<LinhaParceiro[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [rpaAberto, setRpaAberto]   = useState<LinhaParceiro | null>(null);

  useEffect(() => {
    async function buscar() {
      if (!perfil?.salao_id) return;
      setCarregando(true);
      const inicioMes = new Date(ano, mes, 1).toISOString().split('T')[0];
      const fimMes    = new Date(ano, mes + 1, 0).toISOString().split('T')[0];

      const { data } = await supabase
        .from('notas_fiscais')
        .select('profissional_nome, cnpj_profissional, tipo_parceiro, valor_cota_profissional')
        .eq('salao_id', perfil.salao_id)
        .not('profissional_nome', 'is', null)
        .gt('valor_cota_profissional', 0)
        .gte('data_movimentacao', `${inicioMes}T00:00:00Z`)
        .lte('data_movimentacao', `${fimMes}T23:59:59Z`);

      const agrupado: Record<string, LinhaParceiro> = {};
      for (const r of data || []) {
        const k = r.profissional_nome!;
        if (!agrupado[k]) agrupado[k] = { nome: k, tipo: r.tipo_parceiro ?? null, cnpj: r.cnpj_profissional ?? null, cotaBruta: 0, qtd: 0 };
        agrupado[k].cotaBruta += Number(r.valor_cota_profissional) || 0;
        agrupado[k].qtd += 1;
        if (!agrupado[k].cnpj && r.cnpj_profissional) agrupado[k].cnpj = r.cnpj_profissional;
        if (!agrupado[k].tipo && r.tipo_parceiro) agrupado[k].tipo = r.tipo_parceiro;
      }
      setLinhas(Object.values(agrupado).sort((a, b) => b.cotaBruta - a.cotaBruta));
      setCarregando(false);
    }
    buscar();
  }, [perfil?.salao_id, mes, ano]);

  const totais = useMemo(() => {
    let cnpj = 0, cpf = 0;
    for (const l of linhas) {
      const ehCnpj = l.tipo === 'parceiro_cnpj' || (!l.tipo && (l.cnpj || '').replace(/\D/g, '').length === 14);
      if (ehCnpj) cnpj += l.cotaBruta; else cpf += l.cotaBruta;
    }
    return { cnpj, cpf, inss: cpf * INSS_PERC, basePgdas: cpf };
  }, [linhas]);

  function exportarCSV() {
    const mesStr = String(mes + 1).padStart(2, '0');
    const linhasCpf = linhas.filter(l => {
      const ehCnpj = l.tipo === 'parceiro_cnpj' || (!l.tipo && (l.cnpj || '').replace(/\D/g, '').length === 14);
      return !ehCnpj;
    });
    gerarCSV(
      ['Competência', 'Nome Profissional', 'Natureza', 'Valor Bruto (R$)', 'INSS Retido 11% (R$)', 'Líquido (R$)', 'GPS 2100'],
      linhasCpf.map(l => [
        `${ano}-${mesStr}`,
        l.nome,
        '13001 - Pagamento a autônomo',
        l.cotaBruta.toFixed(2).replace('.', ','),
        (l.cotaBruta * INSS_PERC).toFixed(2).replace('.', ','),
        (l.cotaBruta * (1 - INSS_PERC)).toFixed(2).replace('.', ','),
        (l.cotaBruta * INSS_PERC).toFixed(2).replace('.', ','),
      ]),
      `EFD-Reinf_R4010_${ano}${mesStr}.csv`,
    );
  }

  const thStyle: React.CSSProperties = {
    padding: '8px 12px', textAlign: 'left', fontSize: 10,
    fontWeight: 700, color: C.textLight, textTransform: 'uppercase',
    borderBottom: `1px solid ${C.border}`,
  };
  const tdStyle: React.CSSProperties = { padding: '10px 12px', fontSize: 12, color: C.textMain, borderBottom: `1px solid ${C.border}` };

  return (
    <div style={{ ...estiloCard, marginBottom: 24 }}>

      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, background: '#F0FDF4', borderRadius: RAIO_MD,
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FiShield size={18} color="#16A34A" />
          </div>
          <div>
            <h3 className="font-title" style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.sidebarBg }}>
              5. Fiscal Parceiros — Lei 13.352/2016
            </h3>
            <p style={{ margin: 0, fontSize: 11, color: C.textMuted }}>
              Cota-parte, RPA e base PGDAS-D — {mesAnoLabel}
            </p>
          </div>
        </div>
        {linhas.some(l => {
          const ehCnpj = l.tipo === 'parceiro_cnpj' || (!l.tipo && (l.cnpj || '').replace(/\D/g, '').length === 14);
          return !ehCnpj;
        }) && (
          <button style={estiloBtnCSV as any} onClick={exportarCSV}>
            <FiDownload size={13} /> CSV EFD-Reinf R-4010
          </button>
        )}
      </div>

      {carregando && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.textMuted, fontSize: 13, padding: '16px 0' }}>
          <FiLoader className="animate-spin" size={14} /> Carregando cota-parte...
        </div>
      )}

      {!carregando && linhas.length === 0 && (
        <div style={{ fontSize: 12, color: C.textLight, padding: '12px 0' }}>
          Nenhum repasse de parceiro encontrado em {MESES[mes]} {ano}.
        </div>
      )}

      {!carregando && linhas.length > 0 && (
        <>
          {/* Mini cards resumo */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
            {totais.cnpj > 0 && (
              <MiniCard label="Cotas CNPJ" valor={brl(totais.cnpj)} cor="#22C55E"
                sub="Deduzir da receita bruta no PGDAS-D" />
            )}
            {totais.cpf > 0 && (
              <MiniCard label="Cotas CPF / RPA" valor={brl(totais.cpf)} cor="#F59E0B"
                sub="Permanecem na receita bruta" />
            )}
            {totais.inss > 0 && (
              <MiniCard label="INSS a Reter (11%)" valor={brl(totais.inss)} cor="#EF4444"
                sub="GPS cód. 2100 — recolher até dia 20" />
            )}
            {totais.cpf > 0 && (
              <MiniCard label="Líquido a Repassar (CPF)" valor={brl(totais.cpf - totais.inss)} cor="#3B82F6" />
            )}
          </div>

          {/* Tabela */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: C.bg }}>
                  {['Profissional', 'Tipo', 'Cota-parte Bruta', 'INSS (11%)', 'Líquido', 'Ação'].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhas.map(l => {
                  const ehCnpj = l.tipo === 'parceiro_cnpj' || (!l.tipo && (l.cnpj || '').replace(/\D/g, '').length === 14);
                  const inss   = ehCnpj ? 0 : l.cotaBruta * INSS_PERC;
                  return (
                    <tr key={l.nome}>
                      <td style={tdStyle}><strong>{l.nome}</strong></td>
                      <td style={tdStyle}><BadgeTipo tipo={l.tipo} cnpj={l.cnpj} /></td>
                      <td style={{ ...tdStyle, fontWeight: 700 }}>{brl(l.cotaBruta)}</td>
                      <td style={{ ...tdStyle, color: inss > 0 ? '#B45309' : C.textLight }}>
                        {inss > 0 ? `− ${brl(inss)}` : '—'}
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 700, color: '#15803D' }}>
                        {brl(l.cotaBruta - inss)}
                      </td>
                      <td style={tdStyle}>
                        {!ehCnpj && (
                          <button onClick={() => setRpaAberto(l)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
                              padding: '4px 10px', borderRadius: RAIO_MD, background: '#1E293B',
                              color: '#fff', border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                            <FiPrinter size={11} /> RPA
                          </button>
                        )}
                        {ehCnpj && (
                          <span style={{ fontSize: 11, color: '#166534' }}>
                            Aguardar NFS-e do prestador
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Alertas de obrigações */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
            {totais.cnpj > 0 && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start',
                background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: RAIO_MD, padding: '10px 14px' }}>
                <FiCheckCircle size={13} color="#16A34A" style={{ flexShrink: 0, marginTop: 2 }} />
                <p style={{ margin: 0, fontSize: 11, color: '#166534', lineHeight: 1.6 }}>
                  <strong>Parceiros CNPJ:</strong> solicite a NFS-e de cada profissional referente à cota de {MESES[mes]}.
                  Após receber, registre como despesa e deduza {brl(totais.cnpj)} da receita bruta no PGDAS-D.
                </p>
              </div>
            )}
            {totais.inss > 0 && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start',
                background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: RAIO_MD, padding: '10px 14px' }}>
                <FiAlertTriangle size={13} color="#D97706" style={{ flexShrink: 0, marginTop: 2 }} />
                <p style={{ margin: 0, fontSize: 11, color: '#92400E', lineHeight: 1.6 }}>
                  <strong>Parceiros CPF — GPS 2100:</strong> recolher {brl(totais.inss)} de INSS autônomo
                  até o dia 20 do mês seguinte. Exporte o CSV acima para a EFD-Reinf R-4010 (competência {MESES[mes]}/{ano}).
                  Prazo de envio: até o dia 15 do mês seguinte.
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {rpaAberto && (
        <ModalRpa
          profissionalNome={rpaAberto.nome}
          valorBruto={rpaAberto.cotaBruta}
          mes={mes + 1}
          ano={ano}
          salaoId={perfil.salao_id}
          onFechar={() => setRpaAberto(null)}
        />
      )}
    </div>
  );
}

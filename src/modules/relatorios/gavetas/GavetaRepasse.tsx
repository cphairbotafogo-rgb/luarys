'use client'

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { C, brl } from '@/lib/constants';
import { RAIO_MD, RAIO_XL, RAIO_XS } from '@/lib/estiloGlobal';
import { FiAlertTriangle, FiCheckCircle, FiInfo, FiLoader, FiFileText, FiPrinter } from 'react-icons/fi';
import { ModalRpa } from './ModalRpa';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface LinhaRepasse {
  profissional_nome: string;
  cnpj_profissional: string | null;
  tipo_parceiro: string | null;
  total_cota: number;
  qtd_notas: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const INSS_PERC = 0.11;

function fmtCnpj(v: string | null) {
  if (!v) return null;
  const d = v.replace(/\D/g, '');
  if (d.length !== 14) return v;
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
}

// ─── Badge tipo de parceiro ───────────────────────────────────────────────────

function BadgeTipo({ tipo, cnpj }: { tipo: string | null; cnpj: string | null }) {
  const temCnpj = (cnpj || '').replace(/\D/g, '').length === 14;
  if (tipo === 'parceiro_cnpj' || (tipo === null && temCnpj)) {
    return (
      <span style={{ background: '#DCFCE7', color: '#166534', borderRadius: RAIO_XS,
        padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
        Parceiro CNPJ
      </span>
    );
  }
  if (tipo === 'parceiro_cpf' || (tipo === null && !temCnpj)) {
    return (
      <span style={{ background: '#FEF9C3', color: '#854D0E', borderRadius: RAIO_XS,
        padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
        Parceiro CPF (RPA)
      </span>
    );
  }
  if (tipo === 'clt') return <span style={{ background: '#DBEAFE', color: '#1E40AF', borderRadius: RAIO_XS, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>CLT</span>;
  return <span style={{ background: '#F3E8FF', color: '#6B21A8', borderRadius: RAIO_XS, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>PJ / Sócio</span>;
}

// ─── Card de repasse por profissional ─────────────────────────────────────────

function CardRepasse({ linha, salaoId, mes, ano }: {
  linha: LinhaRepasse; salaoId: string; mes: number; ano: number;
}) {
  const [rpaAberto, setRpaAberto] = useState(false);

  const ehCnpj = linha.tipo_parceiro === 'parceiro_cnpj'
    || (linha.tipo_parceiro === null && (linha.cnpj_profissional || '').replace(/\D/g, '').length === 14);
  const ehCpf = linha.tipo_parceiro === 'parceiro_cpf'
    || (linha.tipo_parceiro === null && !ehCnpj);

  const inssRetido   = ehCpf ? linha.total_cota * INSS_PERC : 0;
  const liquidoPagar = linha.total_cota - inssRetido;

  return (
    <>
    {rpaAberto && (
      <ModalRpa
        profissionalNome={linha.profissional_nome}
        valorBruto={linha.total_cota}
        mes={mes}
        ano={ano}
        salaoId={salaoId}
        onFechar={() => setRpaAberto(false)}
      />
    )}
    <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, padding: '18px 22px' }}>

      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: C.textMain }}>{linha.profissional_nome}</span>
          <BadgeTipo tipo={linha.tipo_parceiro} cnpj={linha.cnpj_profissional} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: C.textMuted }}>{linha.qtd_notas} {linha.qtd_notas === 1 ? 'serviço' : 'serviços'} no período</span>
          {ehCpf && (
            <button onClick={() => setRpaAberto(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
                borderRadius: RAIO_MD, background: '#1E293B', color: '#fff',
                border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              <FiPrinter size={13} /> Gerar RPA
            </button>
          )}
        </div>
      </div>

      {/* Valores */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 14 }}>
        <div style={{ background: C.bg, borderRadius: RAIO_MD, padding: '12px 16px' }}>
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>Cota-parte bruta</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.textMain }}>{brl(linha.total_cota)}</div>
        </div>
        {ehCpf && (
          <>
            <div style={{ background: '#FFFBEB', borderRadius: RAIO_MD, padding: '12px 16px', border: '1px solid #FDE68A' }}>
              <div style={{ fontSize: 11, color: '#92400E', marginBottom: 4 }}>INSS a reter (11%) — GPS 2100</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#B45309' }}>− {brl(inssRetido)}</div>
            </div>
            <div style={{ background: '#F0FDF4', borderRadius: RAIO_MD, padding: '12px 16px', border: '1px solid #BBF7D0' }}>
              <div style={{ fontSize: 11, color: '#166534', marginBottom: 4 }}>Líquido a repassar</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#15803D' }}>{brl(liquidoPagar)}</div>
            </div>
          </>
        )}
        {ehCnpj && (
          <div style={{ background: '#F0FDF4', borderRadius: RAIO_MD, padding: '12px 16px', border: '1px solid #BBF7D0' }}>
            <div style={{ fontSize: 11, color: '#166534', marginBottom: 4 }}>Total a repassar</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#15803D' }}>{brl(linha.total_cota)}</div>
          </div>
        )}
      </div>

      {/* Orientação fiscal */}
      {ehCnpj && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: '#F0FDF4',
          border: '1px solid #BBF7D0', borderRadius: RAIO_MD, padding: '10px 14px' }}>
          <FiCheckCircle size={14} color="#16A34A" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 12, color: '#166534', lineHeight: 1.6 }}>
            <strong>Profissional deve emitir NFS-e ao salão</strong> pelo valor {brl(linha.total_cota)} como prestação de serviço (cota-parte).
            {linha.cnpj_profissional && (
              <> CNPJ do prestador: <strong>{fmtCnpj(linha.cnpj_profissional)}</strong>.</>
            )}
            {' '}Após receber a nota, o salão registra como despesa e exclui esse valor da receita bruta no PGDAS-D.
          </div>
        </div>
      )}

      {ehCpf && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: '#FFFBEB',
          border: '1px solid #FDE68A', borderRadius: RAIO_MD, padding: '10px 14px' }}>
          <FiAlertTriangle size={14} color="#D97706" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 12, color: '#92400E', lineHeight: 1.6 }}>
            <strong>Parceiro sem CNPJ — emitir RPA.</strong>{' '}
            Reter {brl(inssRetido)} de INSS (11% do bruto) e recolher via GPS código 2100.
            O valor total da cota ({brl(linha.total_cota)}) entra na receita bruta do salão no Simples Nacional.
            Considere solicitar ao profissional que abra MEI para ativar a dedução.
          </div>
        </div>
      )}

      {!ehCnpj && !ehCpf && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: C.bg,
          border: `1px solid ${C.border}`, borderRadius: RAIO_MD, padding: '10px 14px' }}>
          <FiInfo size={14} color={C.textMuted} style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ margin: 0, fontSize: 12, color: C.textMuted }}>
            Regime CLT ou PJ — repasse gerenciado via folha de pagamento ou NFS-e avulsa.
          </p>
        </div>
      )}
    </div>
    </>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function GavetaRepasse({ perfil }: { perfil: any }) {
  const hoje = new Date();
  const [mes, setMes]       = useState(hoje.getMonth() + 1);
  const [ano, setAno]       = useState(hoje.getFullYear());
  const [linhas, setLinhas] = useState<LinhaRepasse[]>([]);
  const [carregando, setCarregando] = useState(false);

  async function buscar() {
    if (!perfil?.salao_id) return;
    setCarregando(true);
    const inicio = `${ano}-${String(mes).padStart(2, '0')}-01T00:00:00Z`;
    const fim    = new Date(ano, mes, 0);
    const fimStr = `${ano}-${String(mes).padStart(2, '0')}-${String(fim.getDate()).padStart(2, '0')}T23:59:59Z`;

    const { data, error } = await supabase
      .from('notas_fiscais')
      .select('profissional_nome, cnpj_profissional, tipo_parceiro, valor_cota_profissional')
      .eq('salao_id', perfil.salao_id)
      .not('profissional_nome', 'is', null)
      .gt('valor_cota_profissional', 0)
      .gte('data_movimentacao', inicio)
      .lte('data_movimentacao', fimStr);

    if (!error && data) {
      const agrupado: Record<string, LinhaRepasse> = {};
      for (const row of data) {
        const chave = row.profissional_nome!;
        if (!agrupado[chave]) {
          agrupado[chave] = {
            profissional_nome: row.profissional_nome!,
            cnpj_profissional: row.cnpj_profissional ?? null,
            tipo_parceiro: row.tipo_parceiro ?? null,
            total_cota: 0,
            qtd_notas: 0,
          };
        }
        agrupado[chave].total_cota += Number(row.valor_cota_profissional) || 0;
        agrupado[chave].qtd_notas  += 1;
        if (!agrupado[chave].cnpj_profissional && row.cnpj_profissional)
          agrupado[chave].cnpj_profissional = row.cnpj_profissional;
        if (!agrupado[chave].tipo_parceiro && row.tipo_parceiro)
          agrupado[chave].tipo_parceiro = row.tipo_parceiro;
      }
      setLinhas(Object.values(agrupado).sort((a, b) => b.total_cota - a.total_cota));
    }
    setCarregando(false);
  }

  useEffect(() => { buscar(); }, [perfil?.salao_id]);

  const totais = useMemo(() => {
    let cnpj = 0, cpf = 0;
    for (const l of linhas) {
      const ehCnpj = l.tipo_parceiro === 'parceiro_cnpj'
        || (l.tipo_parceiro === null && (l.cnpj_profissional || '').replace(/\D/g, '').length === 14);
      if (ehCnpj) cnpj += l.total_cota;
      else cpf += l.total_cota;
    }
    return { cnpj, cpf };
  }, [linhas]);

  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const anos  = Array.from({ length: 4 }, (_, i) => hoje.getFullYear() - i);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Filtro de período */}
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL,
        padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <FiFileText size={15} color={C.textMuted} />
        <select value={mes} onChange={e => setMes(Number(e.target.value))}
          style={{ border: `1px solid ${C.border}`, borderRadius: RAIO_MD, padding: '6px 10px', fontSize: 13, color: C.textMain, background: C.bg }}>
          {meses.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
        </select>
        <select value={ano} onChange={e => setAno(Number(e.target.value))}
          style={{ border: `1px solid ${C.border}`, borderRadius: RAIO_MD, padding: '6px 10px', fontSize: 13, color: C.textMain, background: C.bg }}>
          {anos.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <button onClick={buscar}
          style={{ padding: '7px 16px', borderRadius: RAIO_MD, background: C.sidebarBg,
            color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          Consultar
        </button>
        {carregando && <FiLoader className="animate-spin" size={16} color={C.textMuted} />}

        {/* Totalizadores */}
        {linhas.length > 0 && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {totais.cnpj > 0 && (
              <div style={{ fontSize: 12, color: '#166534' }}>
                Cotas CNPJ: <strong>{brl(totais.cnpj)}</strong>
              </div>
            )}
            {totais.cpf > 0 && (
              <div style={{ fontSize: 12, color: '#92400E' }}>
                Cotas CPF (RPA): <strong>{brl(totais.cpf)}</strong>
                <span style={{ marginLeft: 6, color: '#B45309' }}>
                  · INSS a reter: <strong>{brl(totais.cpf * INSS_PERC)}</strong>
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sem dados */}
      {!carregando && linhas.length === 0 && (
        <div style={{ textAlign: 'center', padding: 48, color: C.textLight }}>
          <FiFileText size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
          <div>Nenhum repasse encontrado em {meses[mes - 1]} {ano}.</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>Os valores aparecem ao fechar contas com profissionais parceiros.</div>
        </div>
      )}

      {/* Cards */}
      {linhas.map(l => <CardRepasse key={l.profissional_nome} linha={l} salaoId={perfil.salao_id} mes={mes} ano={ano} />)}
    </div>
  );
}

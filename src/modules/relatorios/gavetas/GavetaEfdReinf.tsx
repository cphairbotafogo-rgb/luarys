'use client'

/**
 * GavetaEfdReinf.tsx
 *
 * Gera os dados que o contador precisa para preencher:
 *   - EFD-Reinf R-4010  (substituiu a DIRF desde 01/01/2024)
 *     Remuneração de contribuinte individual (parceiro_cpf) sem vínculo empregatício.
 *   - eSocial S-2300     (cadastro de TSVE — Trabalhador Sem Vínculo de Emprego)
 *     Categoria 701: Contribuinte individual — serviços prestados a empresa.
 *
 * Fonte dos dados: notas_fiscais (tipo_parceiro = 'parceiro_cpf') + profissionais.perfil_avancado.cpf
 */

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { C, brl } from '@/lib/constants';
import { RAIO_MD, RAIO_XL, RAIO_XS } from '@/lib/estiloGlobal';
import { FiDownload, FiInfo, FiAlertTriangle, FiLoader, FiCheck } from 'react-icons/fi';

// ─── Constantes fiscais ────────────────────────────────────────────────────────

const INSS_PERC          = 0.11;
const NATUREZA_RENDIMENTO = '13001'; // Serviços prestados sem vínculo empregatício
const CATEGORIA_ESOCIAL  = '701';   // Contribuinte individual — empresa
const GPS_CODIGO         = '2100';

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface LinhaEfd {
  profissional_nome: string;
  cpf: string | null;            // pode ser null se não cadastrado
  valor_bruto: number;
  inss_retido: number;
  valor_liquido: number;
  competencia: string;           // MM/AAAA
  qtd_notas: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCpf(v: string) {
  const d = v.replace(/\D/g, '');
  if (d.length !== 11) return v;
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
}

function csvEscapar(v: any) {
  const s = String(v ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportarCsvEfdReinf(linhas: LinhaEfd[], cnpjSalao: string, competencia: string) {
  const cab = [
    'Evento','CNPJ_Estabelecimento','Competencia','CPF_Beneficiario','Nome_Beneficiario',
    'Natureza_Rendimento','Codigo_Natureza','Valor_Bruto','INSS_Retido_GPS2100','Valor_Liquido',
  ].join(',');
  const corpo = linhas.map(l => [
    'R-4010',
    csvEscapar((cnpjSalao || '').replace(/\D/g, '')),
    csvEscapar(competencia),
    csvEscapar((l.cpf || '').replace(/\D/g, '')),
    csvEscapar(l.profissional_nome),
    csvEscapar('Remuneração por serviços prestados sem vínculo empregatício'),
    csvEscapar(NATUREZA_RENDIMENTO),
    csvEscapar(l.valor_bruto.toFixed(2).replace('.', ',')),
    csvEscapar(l.inss_retido.toFixed(2).replace('.', ',')),
    csvEscapar(l.valor_liquido.toFixed(2).replace('.', ',')),
  ].join(',')).join('\n');
  const bom = '﻿';
  const blob = new Blob([bom + cab + '\n' + corpo], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `efd_reinf_r4010_${competencia.replace('/', '-')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportarJsonEsocial(linhas: LinhaEfd[], cnpjSalao: string, competencia: string) {
  const [mm, aaaa] = competencia.split('/');
  const payload = {
    eSocial: {
      evento: 'S-2300',
      descricao: 'TSVE — Trabalhador Sem Vínculo de Emprego (Contribuinte Individual)',
      cnpj_empregador: (cnpjSalao || '').replace(/\D/g, ''),
      competencia: `${aaaa}-${mm}`,
      categoria: CATEGORIA_ESOCIAL,
      trabalhadores: linhas.map(l => ({
        cpf: (l.cpf || '').replace(/\D/g, '') || 'NAO_CADASTRADO',
        nome: l.profissional_nome,
        valor_bruto: l.valor_bruto,
        inss_retido: l.inss_retido,
        valor_liquido: l.valor_liquido,
        natureza_rendimento: NATUREZA_RENDIMENTO,
        gps_codigo: GPS_CODIGO,
        obs: 'Parceiro de salão — Lei 13.352/2016, sem vínculo CLT',
      })),
    },
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `esocial_s2300_${competencia.replace('/', '-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function GavetaEfdReinf({ perfil }: { perfil: any }) {
  const hoje = new Date();
  const [mes, setMes]           = useState(hoje.getMonth() + 1);
  const [ano, setAno]           = useState(hoje.getFullYear());
  const [notas, setNotas]       = useState<any[]>([]);
  const [profMap, setProfMap]   = useState<Record<string, string>>({}); // nome → cpf
  const [cnpjSalao, setCnpjSalao] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function buscar() {
    if (!perfil?.salao_id) return;
    setCarregando(true);
    const inicio = `${ano}-${String(mes).padStart(2,'0')}-01T00:00:00Z`;
    const fim    = new Date(ano, mes, 0);
    const fimStr = `${ano}-${String(mes).padStart(2,'0')}-${String(fim.getDate()).padStart(2,'0')}T23:59:59Z`;

    const [resNotas, resProfs, resSalao] = await Promise.all([
      // Inclui tipo_parceiro = 'parceiro_cpf' E registros históricos com tipo_parceiro NULL
      // (notas anteriores à migration de Fatia 2). Dados históricos são filtrados em JS
      // usando o CPF/CNPJ do profissional como desambiguador.
      supabase.from('notas_fiscais')
        .select('profissional_nome, valor_cota_profissional, tipo_parceiro, cnpj_profissional')
        .eq('salao_id', perfil.salao_id)
        .or('tipo_parceiro.eq.parceiro_cpf,tipo_parceiro.is.null')
        .not('profissional_nome', 'is', null)
        .gt('valor_cota_profissional', 0)
        .gte('data_movimentacao', inicio)
        .lte('data_movimentacao', fimStr),
      supabase.from('profissionais')
        .select('nome, perfil_avancado')
        .eq('salao_id', perfil.salao_id),
      supabase.from('saloes')
        .select('cnpj')
        .eq('id', perfil.salao_id)
        .maybeSingle(),
    ]);

    setNotas(resNotas.data || []);
    const mp: Record<string, string> = {};
    for (const p of (resProfs.data || [])) {
      if (p.perfil_avancado?.cpf) mp[p.nome] = p.perfil_avancado.cpf;
    }
    setProfMap(mp);
    setCnpjSalao(resSalao.data?.cnpj || '');
    setCarregando(false);
  }

  useEffect(() => { buscar(); }, [perfil?.salao_id]);

  const competencia = `${String(mes).padStart(2,'0')}/${ano}`;

  const linhas = useMemo<LinhaEfd[]>(() => {
    const agrup: Record<string, LinhaEfd> = {};
    for (const r of notas) {
      // Dados históricos (tipo_parceiro NULL): excluir se o profissional tem CNPJ cadastrado
      // (seria parceiro_cnpj histórico, não entra na EFD-Reinf de autônomos)
      if (!r.tipo_parceiro && r.cnpj_profissional) continue;
      const nome  = r.profissional_nome!;
      const bruto = Number(r.valor_cota_profissional) || 0;
      if (!agrup[nome]) {
        agrup[nome] = {
          profissional_nome: nome,
          cpf: profMap[nome] ?? null,
          valor_bruto: 0, inss_retido: 0, valor_liquido: 0,
          competencia, qtd_notas: 0,
        };
      }
      agrup[nome].valor_bruto += bruto;
      agrup[nome].qtd_notas  += 1;
    }
    for (const l of Object.values(agrup)) {
      l.inss_retido  = Math.round(l.valor_bruto * INSS_PERC * 100) / 100;
      l.valor_liquido = Math.round((l.valor_bruto - l.inss_retido) * 100) / 100;
      l.cpf = profMap[l.profissional_nome] ?? null;
    }
    return Object.values(agrup).sort((a, b) => b.valor_bruto - a.valor_bruto);
  }, [notas, profMap, competencia]);

  const semCpf      = linhas.filter(l => !l.cpf);
  const totalBruto  = linhas.reduce((s, l) => s + l.valor_bruto, 0);
  const totalInss   = linhas.reduce((s, l) => s + l.inss_retido, 0);
  const totalLiq    = linhas.reduce((s, l) => s + l.valor_liquido, 0);
  const anos        = Array.from({ length: 4 }, (_, i) => hoje.getFullYear() - i);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Banner informativo */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: '#EFF6FF',
        border: '1px solid #BFDBFE', borderRadius: RAIO_XL, padding: '14px 18px' }}>
        <FiInfo size={16} color="#1D4ED8" style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: 12, color: '#1E40AF', lineHeight: 1.7 }}>
          <strong>EFD-Reinf R-4010</strong> — declaração mensal de pagamentos a autônomos (substituiu a DIRF em jan/2024).
          Entregue até o dia 15 do mês seguinte à competência pelo SPED.{' '}
          <strong>eSocial S-2300</strong> — cadastro do trabalhador sem vínculo (TSVE, categoria 701) antes do 1º pagamento.
          Passe os arquivos gerados ao seu contador.
        </div>
      </div>

      {/* Aviso de CPF faltando */}
      {semCpf.length > 0 && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: '#FFFBEB',
          border: '1px solid #FDE68A', borderRadius: RAIO_XL, padding: '12px 16px' }}>
          <FiAlertTriangle size={15} color="#D97706" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 12, color: '#92400E' }}>
            <strong>CPF não cadastrado:</strong>{' '}
            {semCpf.map(l => l.profissional_nome).join(', ')}.{' '}
            Acesse Equipe → editar profissional → aba Dados Pessoais e preencha o CPF.
          </div>
        </div>
      )}

      {/* Filtro de período + exportar */}
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL,
        padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <select value={mes} onChange={e => setMes(Number(e.target.value))}
          style={{ border: `1px solid ${C.border}`, borderRadius: RAIO_MD, padding: '6px 10px', fontSize: 13, color: C.textMain, background: C.bg }}>
          {MESES.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
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

        {linhas.length > 0 && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button onClick={() => exportarCsvEfdReinf(linhas, cnpjSalao, competencia)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                borderRadius: RAIO_MD, background: '#166534', color: '#fff',
                border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              <FiDownload size={13} /> CSV — EFD-Reinf R-4010
            </button>
            <button onClick={() => exportarJsonEsocial(linhas, cnpjSalao, competencia)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                borderRadius: RAIO_MD, background: '#1D4ED8', color: '#fff',
                border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              <FiDownload size={13} /> JSON — eSocial S-2300
            </button>
          </div>
        )}
      </div>

      {/* Tabela */}
      {linhas.length > 0 && (
        <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: C.textMain }}>
              Competência {competencia} — {linhas.length} profissional(is) autônomo(s)
            </span>
            <span style={{ fontSize: 12, color: C.textMuted }}>
              Natureza {NATUREZA_RENDIMENTO} · GPS {GPS_CODIGO}
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: C.bg }}>
                  {['Profissional','CPF','Serviços','Valor Bruto','INSS 11% (GPS 2100)','Valor Líquido'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Profissional' || h === 'CPF' ? 'left' : 'right',
                      fontSize: 11, fontWeight: 700, color: C.textMuted, borderBottom: `1px solid ${C.border}` }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhas.map(l => (
                  <tr key={l.profissional_nome} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: C.textMain }}>
                      {l.profissional_nome}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {l.cpf ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <FiCheck size={12} color="#16A34A" />
                          <span style={{ color: C.textMuted }}>{fmtCpf(l.cpf)}</span>
                        </span>
                      ) : (
                        <span style={{ background: '#FEF3C7', color: '#92400E', borderRadius: RAIO_XS,
                          padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                          Não cadastrado
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: C.textMuted }}>{l.qtd_notas}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: C.textMain }}>
                      {brl(l.valor_bruto)}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#B45309', fontWeight: 600 }}>
                      {brl(l.inss_retido)}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#15803D' }}>
                      {brl(l.valor_liquido)}
                    </td>
                  </tr>
                ))}
                {/* Totais */}
                <tr style={{ background: C.bg }}>
                  <td colSpan={3} style={{ padding: '12px 14px', fontWeight: 800, fontSize: 13, color: C.textMain }}>
                    TOTAL
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: C.textMain }}>
                    {brl(totalBruto)}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: '#B45309' }}>
                    {brl(totalInss)}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: '#15803D' }}>
                    {brl(totalLiq)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sem dados */}
      {!carregando && linhas.length === 0 && (
        <div style={{ textAlign: 'center', padding: 48, color: C.textLight }}>
          <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>📋</div>
          <div>Nenhum pagamento a autônomo em {MESES[mes - 1]} {ano}.</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>
            Aparecem aqui apenas profissionais com tipo "Parceiro CPF" ao fechar contas.
          </div>
        </div>
      )}

      {/* Checklist contador */}
      {linhas.length > 0 && (
        <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, padding: '16px 20px' }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: C.textMain, marginBottom: 12 }}>
            Checklist para o contador — competência {competencia}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              `Verificar cadastro eSocial S-2300 de cada autônomo (antes do 1º pagamento)`,
              `Transmitir EFD-Reinf R-4010 até dia 15/${String(mes % 12 + 1).padStart(2,'0')}/${mes === 12 ? ano + 1 : ano}`,
              `Recolher GPS código 2100 — total INSS: ${brl(totalInss)} — vencimento mesmo dia`,
              `Manter RPAs assinados em arquivo por 5 anos (art. 6º da Lei 13.352/2016)`,
              semCpf.length > 0 ? `⚠ CPF pendente: ${semCpf.map(l => l.profissional_nome).join(', ')} — completar antes da transmissão` : null,
            ].filter(Boolean).map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <div style={{ width: 18, height: 18, border: `2px solid ${C.border}`, borderRadius: 4, flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 12, color: item?.startsWith('⚠') ? '#92400E' : C.textMuted, lineHeight: 1.5 }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

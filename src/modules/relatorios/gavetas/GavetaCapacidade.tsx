'use client'
/**
 * src/modules/relatorios/gavetas/GavetaCapacidade.tsx
 *
 * Relatório comparativo de capacidade contratada, capacidade efetiva e
 * ocupação real de todos os profissionais do salão, agrupados por função
 * (cabelo / unhas / estética etc.), com exportação em PDF.
 *
 * Consome a mesma lógica central usada na seção de capacidade do
 * demonstrativo individual (GavetaComissoes.tsx) — useCapacidadeProfissional —
 * garantindo que os dois lugares nunca divirjam no cálculo.
 */

import { useState, useMemo } from 'react';
import { C, brl } from '@/lib/constants';
import { RAIO_MD, RAIO_LG, RAIO_XL } from '@/lib/estiloGlobal';
import { temPermissao } from '@/lib/permissoes';
import { FiClock, FiUsers, FiDownload, FiAlertTriangle, FiCalendar } from 'react-icons/fi';
import { useCapacidadeProfissional } from '@/modules/relatorios/hooks/useCapacidadeProfissional';

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

// ─── GERADOR DE PDF via jsPDF (mesmo padrão do GavetaFechamentoContabil) ───
async function gerarPDFCapacidade(
  titulo: string,
  subtitulo: string,
  cabecalho: string[],
  linhas: (string | number)[][],
  nomeArquivo: string,
  nomeSalao: string,
  mesAnoLabel: string
) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const largura = doc.internal.pageSize.getWidth();

  doc.setFillColor(44, 54, 67);
  doc.rect(0, 0, largura, 22, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('ELEVA SAAS', 14, 10);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(nomeSalao, 14, 16);
  doc.text(`Competência: ${mesAnoLabel}`, largura - 14, 16, { align: 'right' });

  doc.setTextColor(44, 54, 67);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(titulo, 14, 32);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(subtitulo, 14, 38);

  autoTable(doc, {
    head: [cabecalho],
    body: linhas.map(l => l.map(c => String(c ?? ''))),
    startY: 44,
    margin: { left: 14, right: 14 },
    styles: { fontSize: 8, cellPadding: 3, font: 'helvetica' },
    headStyles: { fillColor: [44, 54, 67], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 249, 250] },
  });

  const totalPaginas = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Gerado em ${new Date().toLocaleString('pt-BR')} | Luarys | Página ${i} de ${totalPaginas}`,
      14, doc.internal.pageSize.getHeight() - 5
    );
  }

  doc.save(nomeArquivo);
}

export function GavetaCapacidade({ dados, perfil }: any) {
  const agora = new Date();
  const [mes, setMes] = useState(agora.getMonth());
  const [ano, setAno] = useState(agora.getFullYear());
  const [gerandoPDF, setGerandoPDF] = useState(false);

  const podeVerEquipe = perfil?.isDono || temPermissao(perfil, 'auditoria.ver_extrato_capacidade_equipe');
  const podeVerProprio = temPermissao(perfil, 'auditoria.ver_extrato_capacidade_proprio');

  const profissionais = dados?.profs || [];
  const agendamentos = dados?.agendamentos || [];

  const { dataInicio, dataFim } = useMemo(() => {
    const primeiro = new Date(ano, mes, 1).toISOString().split('T')[0];
    const ultimo = new Date(ano, mes + 1, 0).toISOString().split('T')[0];
    return { dataInicio: primeiro, dataFim: ultimo };
  }, [mes, ano]);

  // Profissionais visíveis dependem da permissão: quem só tem o "próprio"
  // só calcula e vê a si mesmo; quem tem "equipe" vê todos.
  const profissionaisVisiveis = useMemo(() => {
    if (podeVerEquipe) return profissionais;
    if (podeVerProprio) return profissionais.filter((p: any) => p.id === perfil?.profissional_id);
    return [];
  }, [profissionais, podeVerEquipe, podeVerProprio, perfil]);

  // Ticket médio por profissional: receita (valor_cobrado/valor_total/preço do
  // serviço) de atendimentos Finalizados no período, dividida pelas horas
  // que ele de fato atendeu. Aproximação suficiente para estimar impacto —
  // o valor "oficial" de comissão vive em GavetaComissoes, não aqui.
  const ticketMedioPorProfissional = useMemo(() => {
    const receitaPorProf: Record<string, number> = {};
    const minutosPorProf: Record<string, number> = {};
    const servicos = dados?.servicos || [];

    agendamentos
      .filter((ag: any) => ag.status === 'Finalizado' && ag.data >= dataInicio && ag.data <= dataFim)
      .forEach((ag: any) => {
        const serv = servicos.find((s: any) => s.id === ag.servico_id);
        const valor = Number(ag.valor_cobrado || ag.valor_total || serv?.preco_padrao || 0);
        receitaPorProf[ag.profissional_id] = (receitaPorProf[ag.profissional_id] || 0) + valor;
        minutosPorProf[ag.profissional_id] = (minutosPorProf[ag.profissional_id] || 0) + (Number(ag.duracao_min) || 0);
      });

    const resultado: Record<string, number> = {};
    Object.keys(receitaPorProf).forEach(profId => {
      const minutos = minutosPorProf[profId] || 0;
      resultado[profId] = minutos > 0 ? receitaPorProf[profId] / (minutos / 60) : 0;
    });
    return resultado;
  }, [agendamentos, dados, dataInicio, dataFim]);

  const capacidades = useCapacidadeProfissional({
    profissionais: profissionaisVisiveis,
    agendamentos,
    dataInicio,
    dataFim,
    ticketMedioPorProfissional,
  });

  // ─── AGRUPAMENTO POR FUNÇÃO/CATEGORIA ───
  const gruposPorFuncao = useMemo(() => {
    const mapa: Record<string, typeof capacidades> = {};
    capacidades.forEach(cap => {
      const prof = profissionaisVisiveis.find((p: any) => p.id === cap.profissionalId);
      const funcao = prof?.perfil_avancado?.contrato?.funcao || 'Geral';
      if (!mapa[funcao]) mapa[funcao] = [];
      mapa[funcao].push(cap);
    });
    return Object.entries(mapa).sort((a, b) => a[0].localeCompare(b[0]));
  }, [capacidades, profissionaisVisiveis]);

  function corOcupacao(taxa: number) {
    if (taxa >= 0.8) return C.success;
    if (taxa >= 0.5) return '#D97706';
    return C.danger;
  }

  async function exportarPDF() {
    setGerandoPDF(true);
    try {
      const linhas: (string | number)[][] = [];
      gruposPorFuncao.forEach(([funcao, lista]) => {
        lista.forEach(cap => {
          linhas.push([
            funcao,
            cap.nome,
            (cap.capacidadeContratadaMin / 60).toFixed(1) + 'h',
            (cap.capacidadeEfetivaMin / 60).toFixed(1) + 'h',
            (cap.horasOcupadasMin / 60).toFixed(1) + 'h',
            (cap.taxaOcupacao * 100).toFixed(0) + '%',
            brl(cap.impactoFinanceiroEstimado),
          ]);
        });
      });

      await gerarPDFCapacidade(
        'Capacidade e Ocupação da Equipe',
        `Comparativo por profissional e categoria — Competência: ${MESES[mes]}/${ano}`,
        ['Categoria', 'Profissional', 'Contratada', 'Efetiva', 'Ocupada', 'Ocupação', 'Impacto estimado'],
        linhas,
        `Capacidade_Equipe_${MESES[mes]}${ano}.pdf`,
        perfil?.nome_fantasia || 'Salão',
        `${MESES[mes]}/${ano}`
      );
    } finally {
      setGerandoPDF(false);
    }
  }

  const card = { background: C.bgCard, padding: 24, borderRadius: RAIO_XL, border: `1px solid ${C.border}` };

  if (!podeVerEquipe && !podeVerProprio) {
    return <p style={{ color: C.danger, fontWeight: 700 }}>Acesso restrito.</p>;
  }

  return (
    <div style={{ animation: 'fadeIn 0.2s ease-out', display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* HEADER + FILTROS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ background: C.sidebarBg, padding: 12, borderRadius: RAIO_XL, color: '#fff' }}>
            <FiClock size={24} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: C.sidebarBg, textTransform: 'uppercase', letterSpacing: '1px' }}>
              Capacidade e ocupação
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: C.textMuted, fontWeight: 500 }}>
              Comparativo de faltas, atrasos e ocupação real por profissional e categoria.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <select value={mes} onChange={e => setMes(Number(e.target.value))} style={{ padding: '10px 14px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 13, fontWeight: 600 }}>
            {MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select value={ano} onChange={e => setAno(Number(e.target.value))} style={{ padding: '10px 14px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 13, fontWeight: 600 }}>
            {[agora.getFullYear() - 1, agora.getFullYear(), agora.getFullYear() + 1].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <button onClick={exportarPDF} disabled={gerandoPDF} className="transition-all hover:opacity-90 shadow-sm" style={{ background: C.sidebarBg, color: '#fff', border: 'none', padding: '12px 20px', borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: gerandoPDF ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, textTransform: 'uppercase', letterSpacing: '0.5px', opacity: gerandoPDF ? 0.7 : 1 }}>
            <FiDownload size={16} /> {gerandoPDF ? 'Gerando...' : 'Exportar PDF'}
          </button>
        </div>
      </div>

      {capacidades.length === 0 && (
        <div style={{ ...card, textAlign: 'center', color: C.textMuted }}>
          <FiCalendar size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
          <p style={{ margin: 0 }}>Nenhum profissional com dados de capacidade neste período.</p>
        </div>
      )}

      {gruposPorFuncao.map(([funcao, lista]) => (
        <div key={funcao} style={card}>
          <h4 style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 800, color: C.sidebarBg, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <FiUsers size={14} /> {funcao}
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {lista.map(cap => (
              <div key={cap.profissionalId} style={{ border: `1px solid ${C.borderMid}`, borderRadius: RAIO_LG, padding: '14px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.textMain }}>{cap.nome}</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: corOcupacao(cap.taxaOcupacao) }}>
                    {(cap.taxaOcupacao * 100).toFixed(0)}% ocupação
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: cap.impactoFinanceiroEstimado > 0 ? 10 : 0 }}>
                  <div>
                    <p style={{ margin: '0 0 2px', fontSize: 10, color: C.textMuted, textTransform: 'uppercase' }}>Contratada</p>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{(cap.capacidadeContratadaMin / 60).toFixed(1)}h</p>
                  </div>
                  <div>
                    <p style={{ margin: '0 0 2px', fontSize: 10, color: C.textMuted, textTransform: 'uppercase' }}>Efetiva</p>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{(cap.capacidadeEfetivaMin / 60).toFixed(1)}h</p>
                  </div>
                  <div>
                    <p style={{ margin: '0 0 2px', fontSize: 10, color: C.textMuted, textTransform: 'uppercase' }}>Ocupada</p>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{(cap.horasOcupadasMin / 60).toFixed(1)}h</p>
                  </div>
                  <div>
                    <p style={{ margin: '0 0 2px', fontSize: 10, color: C.textMuted, textTransform: 'uppercase' }}>Ocorrências</p>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{cap.ocorrencias.length}</p>
                  </div>
                </div>

                {cap.impactoFinanceiroEstimado > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.danger, fontWeight: 600 }}>
                    <FiAlertTriangle size={13} /> Impacto estimado das ausências: {brl(cap.impactoFinanceiroEstimado)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
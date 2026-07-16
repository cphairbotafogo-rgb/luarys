/**
 * src/modules/relatorios/hooks/useRelatorioAtendimentos.ts
 *
 * Lógica de filtros, cálculo de resumo e montagem da hierarquia
 * (Dia > Profissional > Visitas) para GavetaAtendimentos.tsx.
 *
 * "Visita" = uma presença do cliente no salão.
 * Um cliente pode receber N serviços em uma visita; o valor real é o do
 * registro em `financeiro` (linked via agendamento_ids), não a soma de
 * valor_final das linhas individuais (que pode estar zerada em serviços
 * adicionais de uma mesma conta).
 */
import { useState, useMemo } from 'react';
import { brl } from '@/lib/constants';
import { mapAgParaFin, agruparEmVisitas, type Visita } from '@/lib/visitasUtils';

export type { Visita };
export type FiltroStatus = 'finalizados' | 'todos';
export type AtalhoPeriodo = 'hoje' | 'semana' | 'mes' | 'ano' | 'livre';

const STATUS_FINALIZADO = 'Finalizado';
const STATUS_INCLUIDOS_TODOS = ['Finalizado', 'Cancelado', 'Faltou'];

export function paraISO(d: Date) {
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export function calcularRangePorAtalho(atalho: AtalhoPeriodo): { inicio: string; fim: string } {
  const hoje = new Date();
  if (atalho === 'hoje') {
    const iso = paraISO(hoje);
    return { inicio: iso, fim: iso };
  }
  if (atalho === 'semana') {
    const diaSemana = hoje.getDay();
    const inicio = new Date(hoje);
    inicio.setDate(hoje.getDate() - diaSemana);
    const fim = new Date(inicio);
    fim.setDate(inicio.getDate() + 6);
    return { inicio: paraISO(inicio), fim: paraISO(fim) };
  }
  if (atalho === 'mes') {
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    return { inicio: paraISO(inicio), fim: paraISO(fim) };
  }
  if (atalho === 'ano') {
    const inicio = new Date(hoje.getFullYear(), 0, 1);
    const fim = new Date(hoje.getFullYear(), 11, 31);
    return { inicio: paraISO(inicio), fim: paraISO(fim) };
  }
  return { inicio: paraISO(hoje), fim: paraISO(hoje) };
}

export function formatarDataLabel(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

export const DIAS_SEMANA = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

export async function gerarPDFAtendimentos(
  cabecalho: string[],
  linhas: (string | number)[][],
  nomeArquivo: string,
  nomeSalao: string,
  periodoLabel: string
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
  doc.text(`Período: ${periodoLabel}`, largura - 14, 16, { align: 'right' });

  doc.setTextColor(44, 54, 67);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Relatório de Atendimentos', 14, 32);

  autoTable(doc, {
    head: [cabecalho],
    body: linhas.map(l => l.map(c => String(c ?? ''))),
    startY: 40,
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

export function useRelatorioAtendimentos(dados: any, perfil: any) {
  const [atalho, setAtalho] = useState<AtalhoPeriodo>('mes');
  const [dataInicio, setDataInicio] = useState(() => calcularRangePorAtalho('mes').inicio);
  const [dataFim, setDataFim] = useState(() => calcularRangePorAtalho('mes').fim);
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('finalizados');
  const [filtroProfissionalId, setFiltroProfissionalId] = useState<string>('todos');
  const [filtroServicoId, setFiltroServicoId] = useState<string>('todos');
  const [filtroCliente, setFiltroCliente] = useState<string>('');

  function aplicarAtalho(novoAtalho: AtalhoPeriodo) {
    setAtalho(novoAtalho);
    if (novoAtalho !== 'livre') {
      const { inicio, fim } = calcularRangePorAtalho(novoAtalho);
      setDataInicio(inicio);
      setDataFim(fim);
    }
  }

  function editarDataInicio(valor: string) { setDataInicio(valor); setAtalho('livre'); }
  function editarDataFim(valor: string) { setDataFim(valor); setAtalho('livre'); }

  const mapaProfissionais = useMemo(() => {
    const m = new Map<string, string>();
    (dados?.profs || []).forEach((p: any) => m.set(p.id, p.nome || 'Sem nome'));
    return m;
  }, [dados?.profs]);

  const mapaServicos = useMemo(() => {
    const m = new Map<string, string>();
    (dados?.servicos || []).forEach((s: any) => m.set(s.id, s.nome_servico || 'Sem nome'));
    return m;
  }, [dados?.servicos]);

  const mapAgToFin = useMemo(() => mapAgParaFin(dados?.financeiro || []), [dados?.financeiro]);

  const agendamentosFiltrados = useMemo(() => {
    const statusPermitidos = filtroStatus === 'finalizados' ? [STATUS_FINALIZADO] : STATUS_INCLUIDOS_TODOS;
    return (dados?.agendamentos || []).filter((ag: any) => {
      if (!ag.data || ag.data < dataInicio || ag.data > dataFim) return false;
      if (!statusPermitidos.includes(ag.status)) return false;
      if (filtroProfissionalId !== 'todos' && ag.profissional_id !== filtroProfissionalId) return false;
      if (filtroServicoId !== 'todos' && ag.servico_id !== filtroServicoId) return false;
      if (filtroCliente.trim()) {
        const busca = filtroCliente.toLowerCase();
        if (!(ag.cliente_nome || '').toLowerCase().includes(busca)) return false;
      }
      return true;
    });
  }, [dados?.agendamentos, dataInicio, dataFim, filtroStatus, filtroProfissionalId, filtroServicoId, filtroCliente]);

  const visitasFiltradas = useMemo(() =>
    agruparEmVisitas(agendamentosFiltrados, dados?.financeiro || [], dados?.agendamentos || []),
  [agendamentosFiltrados, dados?.financeiro, dados?.agendamentos]);

  const resumo = useMemo(() => {
    const total = visitasFiltradas.length;
    const finalizadas = visitasFiltradas.filter(v => v.status === STATUS_FINALIZADO);
    const faturamento = finalizadas.reduce((acc, v) => acc + v.valorTotal, 0);
    const ticketMedio = finalizadas.length > 0 ? faturamento / finalizadas.length : 0;
    const naoFinalizadas = visitasFiltradas.filter(v => v.status !== STATUS_FINALIZADO).length;
    const taxaFalhaPct = total > 0 ? (naoFinalizadas / total) * 100 : 0;
    return { total, faturamento, ticketMedio, taxaFalhaPct, mostrarTaxa: filtroStatus === 'todos' };
  }, [visitasFiltradas, filtroStatus]);

  // Hierarquia: Dia > Profissional > Visitas
  const hierarquia = useMemo(() => {
    const porDia = new Map<string, Visita[]>();
    visitasFiltradas.forEach(v => {
      if (!porDia.has(v.data)) porDia.set(v.data, []);
      porDia.get(v.data)!.push(v);
    });

    return Array.from(porDia.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([data, visitasDoDia]) => {
        const porProfissional = new Map<string, Visita[]>();
        visitasDoDia.forEach(v => {
          const chave = v.profissional_id || 'sem-profissional';
          if (!porProfissional.has(chave)) porProfissional.set(chave, []);
          porProfissional.get(chave)!.push(v);
        });

        const profissionaisDoDia = Array.from(porProfissional.entries())
          .map(([profId, visitas]) => {
            const nomeProf = mapaProfissionais.get(profId) || 'Sem profissional';
            const faturamentoProf = visitas
              .filter(v => v.status === STATUS_FINALIZADO)
              .reduce((acc, v) => acc + v.valorTotal, 0);
            return {
              profissionalId: profId,
              nomeProf,
              itens: visitas.sort((a, b) => (a.inicio || '').localeCompare(b.inicio || '')),
              totalAtendimentos: visitas.length,
              faturamento: faturamentoProf,
            };
          })
          .sort((a, b) => a.nomeProf.localeCompare(b.nomeProf));

        const faturamentoDia = profissionaisDoDia.reduce((acc, p) => acc + p.faturamento, 0);
        return { data, profissionaisDoDia, totalAtendimentosDia: visitasDoDia.length, faturamentoDia };
      });
  }, [visitasFiltradas, mapaProfissionais]);

  async function exportarPDF() {
    const cabecalho = ['Data', 'Profissional', 'Hora', 'Cliente', 'Serviços', 'Status', 'Valor'];
    const linhas: (string | number)[][] = [];
    hierarquia.forEach(dia => {
      dia.profissionaisDoDia.forEach(grupo => {
        grupo.itens.forEach(v => {
          const nomeServicos = v.servicoIds.map(id => mapaServicos.get(id) || '-').join(' + ');
          linhas.push([
            formatarDataLabel(dia.data),
            grupo.nomeProf,
            v.inicio || '-',
            v.cliente_nome || '-',
            nomeServicos || '-',
            v.status,
            brl(v.valorTotal),
          ]);
        });
      });
    });

    const periodoLabel = `${formatarDataLabel(dataInicio)} a ${formatarDataLabel(dataFim)}`;
    await gerarPDFAtendimentos(cabecalho, linhas, `atendimentos_${dataInicio}_a_${dataFim}.pdf`, perfil?.nome_fantasia || 'Salão', periodoLabel);
  }

  return {
    atalho, dataInicio, dataFim, filtroStatus, filtroProfissionalId, filtroServicoId, filtroCliente,
    aplicarAtalho, editarDataInicio, editarDataFim, setFiltroStatus, setFiltroProfissionalId, setFiltroServicoId, setFiltroCliente,
    mapaServicos, agendamentosFiltrados, visitasFiltradas, resumo, hierarquia, exportarPDF,
  };
}

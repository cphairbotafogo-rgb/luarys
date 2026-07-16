import { useState } from 'react';
import { useToast } from '@/components/Toast';
import { MESES, fmtNum, gerarCSV } from './tipos';
import { gerarPDF } from './gerarPDF';

interface DadosExportacao {
  nomeSalao: string;
  mes: number;
  ano: number;
  mesAnoLabel: string;
  dadosFaturamento: any;
  dadosComissoes: any;
  dadosLivroCaixa: any;
  dadosConciliacao: any;
}

export function useExportacoes(d: DadosExportacao) {
  const [gerandoPDF, setGerandoPDF] = useState<string | null>(null);
  const toast = useToast();

  const { nomeSalao, mes, ano, mesAnoLabel,
    dadosFaturamento, dadosComissoes, dadosLivroCaixa, dadosConciliacao } = d;
  const prefixo = `Luarys_${nomeSalao.replace(/\s/g, '_')}_${MESES[mes]}${ano}`;

  function exportarCSV(relatorio: string) {
    if (relatorio === 'faturamento') {
      gerarCSV(
        ['Data','Descrição','Categoria','Forma Pagamento','Imposto Aplicável','Valor (R$)'],
        dadosFaturamento.linhasDetalhadas, `${prefixo}_Faturamento.csv`
      );
    } else if (relatorio === 'comissoes_agrupado') {
      gerarCSV(
        ['Profissional','Atendimentos','Receita Bruta (R$)','% Comissão','Comissão (R$)','Cota Salão (R$)'],
        dadosComissoes.linhasAgrupadas, `${prefixo}_Comissoes_Agrupado.csv`
      );
    } else if (relatorio === 'comissoes_detalhado') {
      gerarCSV(
        ['Data','Profissional','Serviço','Valor Serviço (R$)','% Comissão','Comissão (R$)','Cota Salão (R$)','Status'],
        dadosComissoes.linhasDetalhadas, `${prefixo}_Comissoes_Detalhado.csv`
      );
    } else if (relatorio === 'livrocaixa') {
      gerarCSV(
        ['Data','Descrição','Categoria','Forma Pagamento','Status','Valor (R$)'],
        dadosLivroCaixa.linhasDetalhadas, `${prefixo}_LivroCaixa.csv`
      );
    } else if (relatorio === 'conciliacao') {
      gerarCSV(
        ['Forma de Pagamento','Transações','Total Bruto (R$)','% do Total'],
        dadosConciliacao.linhas, `${prefixo}_Conciliacao.csv`
      );
    }
  }

  async function exportarPDFRelatorio(relatorio: string) {
    setGerandoPDF(relatorio);
    try {
      if (relatorio === 'faturamento') {
        await gerarPDF(
          'Relatório de Faturamento Mensal',
          `Receitas de Serviços (ISS) e Produtos (ICMS) — ${mesAnoLabel}`,
          ['Data','Descrição','Categoria','Pagamento','Imposto','Valor (R$)'],
          dadosFaturamento.linhasDetalhadas,
          `TOTAL RECEITAS: R$ ${fmtNum(dadosFaturamento.total)} | Serviços: R$ ${fmtNum(dadosFaturamento.totalServicos)} | Produtos: R$ ${fmtNum(dadosFaturamento.totalProdutos)}`,
          `${prefixo}_Faturamento.pdf`, nomeSalao, mesAnoLabel
        );
      } else if (relatorio === 'comissoes') {
        await gerarPDF(
          'Relatório de Comissões — Lei Salão Parceiro',
          `Dedução de comissões da base de cálculo tributária — ${mesAnoLabel}`,
          ['Profissional','Atendimentos','Receita Bruta','% Comissão','Comissão (R$)','Cota Salão (R$)'],
          dadosComissoes.linhasAgrupadas,
          `TOTAL RECEITA: R$ ${fmtNum(dadosComissoes.totalReceita)} | COMISSÕES: R$ ${fmtNum(dadosComissoes.totalComissao)} | COTA SALÃO: R$ ${fmtNum(dadosComissoes.totalSalao)}`,
          `${prefixo}_Comissoes.pdf`, nomeSalao, mesAnoLabel
        );
      } else if (relatorio === 'livrocaixa') {
        await gerarPDF(
          'Livro Caixa / DRE — Despesas',
          `Custos e despesas operacionais por categoria — ${mesAnoLabel}`,
          ['Data','Descrição','Categoria','Pagamento','Status','Valor (R$)'],
          dadosLivroCaixa.linhasDetalhadas,
          `TOTAL DESPESAS: R$ ${fmtNum(dadosLivroCaixa.totalDespesas)} | RECEITAS: R$ ${fmtNum(dadosLivroCaixa.totalReceitas)} | RESULTADO: R$ ${fmtNum(dadosLivroCaixa.resultado)}`,
          `${prefixo}_LivroCaixa.pdf`, nomeSalao, mesAnoLabel
        );
      } else if (relatorio === 'conciliacao') {
        await gerarPDF(
          'Conciliação de Formas de Pagamento',
          `Distribuição de recebimentos por modalidade — ${mesAnoLabel}`,
          ['Forma de Pagamento','Transações','Total Bruto (R$)','% do Total'],
          dadosConciliacao.linhas,
          `TOTAL RECEBIDO: R$ ${fmtNum(dadosConciliacao.totalBruto)}`,
          `${prefixo}_Conciliacao.pdf`, nomeSalao, mesAnoLabel
        );
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.error('Erro ao gerar PDF:', err);
      toast.erro('Erro ao gerar PDF. Verifique se o jsPDF está instalado.');
    } finally {
      setGerandoPDF(null);
    }
  }

  async function exportarKitCompleto() {
    setGerandoPDF('kit');
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const largura = doc.internal.pageSize.getWidth();

      const adicionarSecao = (
        titulo: string, subtitulo: string,
        cabecalho: string[], linhas: (string | number)[][], resumo: string,
        primeiraSecao = false
      ) => {
        if (!primeiraSecao) doc.addPage();
        doc.setFillColor(44, 54, 67);
        doc.rect(0, 0, largura, 22, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('ELEVA SAAS — KIT FECHAMENTO MENSAL', 14, 10);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`${nomeSalao} | ${mesAnoLabel}`, 14, 16);
        doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, largura - 14, 16, { align: 'right' });
        doc.setTextColor(44, 54, 67);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(titulo, 14, 32);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(subtitulo, 14, 38);
        autoTable(doc, {
          head: [cabecalho],
          body: linhas.map(l => l.map(c => String(c ?? ''))),
          startY: 44,
          margin: { left: 14, right: 14 },
          styles: { fontSize: 7.5, cellPadding: 2.5 },
          headStyles: { fillColor: [44, 54, 67], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
          alternateRowStyles: { fillColor: [248, 249, 250] },
          foot: [[{ content: resumo, colSpan: cabecalho.length, styles: { fontStyle: 'bold', fillColor: [241, 245, 249], fontSize: 8 } }]],
          showFoot: 'lastPage',
        });
      };

      adicionarSecao(
        '1. Faturamento Mensal',
        `Receitas de Serviços (ISS Municipal) e Produtos (ICMS Estadual) — ${mesAnoLabel}`,
        ['Data','Descrição','Categoria','Pagamento','Imposto','Valor (R$)'],
        dadosFaturamento.linhasDetalhadas,
        `TOTAL: R$ ${fmtNum(dadosFaturamento.total)} | Serviços: R$ ${fmtNum(dadosFaturamento.totalServicos)} | Produtos: R$ ${fmtNum(dadosFaturamento.totalProdutos)}`,
        true
      );
      adicionarSecao(
        '2. Comissões — Lei Salão Parceiro',
        `Dedução de comissões da base de cálculo tributária — ${mesAnoLabel}`,
        ['Profissional','Atendimentos','Receita Bruta','% Comissão','Comissão (R$)','Cota Salão (R$)'],
        dadosComissoes.linhasAgrupadas,
        `RECEITA TOTAL: R$ ${fmtNum(dadosComissoes.totalReceita)} | COMISSÕES: R$ ${fmtNum(dadosComissoes.totalComissao)} | COTA SALÃO: R$ ${fmtNum(dadosComissoes.totalSalao)}`
      );
      adicionarSecao(
        '3. Livro Caixa — Despesas Operacionais',
        `Custos e despesas categorizados para apuração do resultado — ${mesAnoLabel}`,
        ['Data','Descrição','Categoria','Pagamento','Status','Valor (R$)'],
        dadosLivroCaixa.linhasDetalhadas,
        `DESPESAS: R$ ${fmtNum(dadosLivroCaixa.totalDespesas)} | RECEITAS: R$ ${fmtNum(dadosLivroCaixa.totalReceitas)} | RESULTADO LÍQUIDO: R$ ${fmtNum(dadosLivroCaixa.resultado)}`
      );
      adicionarSecao(
        '4. Conciliação de Formas de Pagamento',
        `Distribuição de recebimentos por modalidade para cruzamento com extrato bancário — ${mesAnoLabel}`,
        ['Forma de Pagamento','Transações','Total Bruto (R$)','% do Total'],
        dadosConciliacao.linhas,
        `TOTAL RECEBIDO: R$ ${fmtNum(dadosConciliacao.totalBruto)}`
      );

      doc.save(`${prefixo}_KitFechamentoContabil.pdf`);
    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.error('Erro ao gerar Kit PDF:', err);
      toast.erro('Erro ao gerar PDF. Verifique se o jsPDF está instalado.');
    } finally {
      setGerandoPDF(null);
    }
  }

  return { gerandoPDF, exportarCSV, exportarPDFRelatorio, exportarKitCompleto };
}

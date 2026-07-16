export async function gerarPDF(
  titulo: string,
  subtitulo: string,
  cabecalho: string[],
  linhas: (string | number)[][],
  rodape: string,
  nomeArquivo: string,
  nomeSalao: string,
  mesAno: string
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
  doc.text(`Competência: ${mesAno}`, largura - 14, 16, { align: 'right' });

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
    foot: rodape ? [[{ content: rodape, colSpan: cabecalho.length, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }]] : undefined,
    showFoot: rodape ? 'lastPage' : 'never',
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

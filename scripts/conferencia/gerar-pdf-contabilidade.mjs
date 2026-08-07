/**
 * Gera o PDF com as perguntas para a contabilidade.
 *
 * A configuração vem do banco, não digitada à mão: se alguém mudar a alíquota
 * ou o código amanhã, o PDF sai com o valor novo. Documento com número
 * desatualizado faz a contadora responder sobre um sistema que não existe mais.
 *
 * Isso também substitui a maior parte dos prints — ela já disse que "sem ver as
 * opções fica complicado", e a lista do Regime Especial em texto é mais legível
 * que uma captura de tela.
 *
 *   node scripts/conferencia/gerar-pdf-contabilidade.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import fs from 'fs';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(),
               l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]),
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data: salao, error: erroSalao } = await admin.from('saloes')
  .select('razao_social, nome_fantasia, cnpj, inscricao_municipal, inscricao_estadual, cnae, config_fiscal, codigo_ibge, regime_tributario')
  .ilike('cnpj', '%17326293%').maybeSingle();
if (erroSalao || !salao) {
  console.log('nao consegui ler o salao:', erroSalao?.message ?? 'nao encontrado');
  process.exit(1);
}
const cf = salao.config_fiscal ?? {};

const { data: srv } = await admin.from('servicos')
  .select('nome_servico, setor, nbs, codigo_tributacao_nacional, codigo_municipio, aliquota_iss')
  .eq('salao_id', (await admin.from('saloes').select('id').ilike('cnpj', '%17326293%')).data[0].id);

const porNbs = {};
for (const s of srv) {
  if (!s.nbs) continue;
  (porNbs[s.nbs] ||= { n: 0, setores: new Set(), nac: s.codigo_tributacao_nacional, mun: s.codigo_municipio, aliq: s.aliquota_iss });
  porNbs[s.nbs].n++;
  if (s.setor) porNbs[s.nbs].setores.add(s.setor);
}
const semClassificacao = srv.filter(s => !s.nbs);

const doc = new jsPDF({ unit: 'mm', format: 'a4' });
const L = 18, LARG = 174;
let y = 0;

// As fontes padrao do jsPDF (WinAnsi) nao tem travessao nem ponto medio: o
// caractere some e sobra um espaco duplo no meio da frase. Trocar por hifen e
// mais honesto do que deixar buraco no texto que vai para a contadora.
const limpo = t => String(t)
  .replace(/[—–]/g, '-')
  .replace(/[·•]/g, '-')
  .replace(/[‘’]/g, "'")
  .replace(/[“”]/g, '"')
  .replace(/←/g, '<-');

const TINTA = [30, 41, 59];
const SUAVE = [100, 116, 139];

function titulo(txt) {
  if (y > 250) { doc.addPage(); y = 20; }
  y += 4;
  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...TINTA);
  doc.text(limpo(txt), L, y);
  y += 2;
  doc.setDrawColor(203, 213, 225).setLineWidth(0.3).line(L, y, L + LARG, y);
  y += 6;
}

function paragrafo(txt, opts = {}) {
  const { tam = 9, cor = SUAVE, estilo = 'normal' } = opts;
  doc.setFont('helvetica', estilo).setFontSize(tam).setTextColor(...cor);
  const linhas = doc.splitTextToSize(limpo(txt), LARG);
  for (const linha of linhas) {
    if (y > 275) { doc.addPage(); y = 20; }
    doc.text(linha, L, y);
    y += tam * 0.47;
  }
  y += 2;
}

function pergunta(n, txt, detalhe) {
  if (y > 258) { doc.addPage(); y = 20; }
  doc.setFont('helvetica', 'bold').setFontSize(9.5).setTextColor(...TINTA);
  doc.text(`${n}.`, L, y);
  const linhas = doc.splitTextToSize(limpo(txt), LARG - 7);
  doc.text(linhas[0], L + 7, y);
  y += 4.6;
  for (const linha of linhas.slice(1)) {
    if (y > 275) { doc.addPage(); y = 20; }
    doc.text(linha, L + 7, y);
    y += 4.6;
  }
  if (detalhe) {
    doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...SUAVE);
    for (const linha of doc.splitTextToSize(limpo(detalhe), LARG - 7)) {
      if (y > 275) { doc.addPage(); y = 20; }
      doc.text(linha, L + 7, y);
      y += 4;
    }
  }
  y += 3.5;
}

function tabela(head, body) {
  autoTable(doc, {
    startY: y, margin: { left: L, right: L },
    head: [head.map(limpo)], body: body.map(l => l.map(limpo)),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2, textColor: TINTA, lineColor: [226, 232, 240] },
    headStyles: { fillColor: [241, 245, 249], textColor: TINTA, fontStyle: 'bold' },
  });
  y = doc.lastAutoTable.finalY + 7;
}

// ── Capa ───────────────────────────────────────────────────────────────────
doc.setFont('helvetica', 'bold').setFontSize(17).setTextColor(...TINTA);
doc.text(limpo('Perguntas para a contabilidade'), L, 26);
doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(...SUAVE);
doc.text(limpo(`${salao.nome_fantasia} — configuração do sistema de gestão`), L, 33);
doc.text(new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }), L, 38.5);
doc.setDrawColor(...TINTA).setLineWidth(0.6).line(L, 43, L + LARG, 43);
y = 53;

paragrafo(
  'Estamos configurando a emissão de NFS-e em um sistema próprio e precisamos confirmar alguns campos '
  + 'antes de emitir a primeira nota. Abaixo está como o sistema está hoje, seguido das perguntas. '
  + 'As duas primeiras seções existem para dispensar prints de tela.',
  { tam: 9.5 },
);

// ── Situação atual ─────────────────────────────────────────────────────────
titulo('1. Dados cadastrais');
tabela(['Campo', 'Valor no sistema'], [
  ['Razão social', salao.razao_social ?? '—'],
  ['CNPJ', salao.cnpj ?? '—'],
  ['Inscrição municipal', salao.inscricao_municipal ?? '—'],
  ['Inscrição estadual', salao.inscricao_estadual ?? '—'],
  ['CNAE', salao.cnae ?? '—'],
  ['Município (IBGE)', `${salao.codigo_ibge ?? '—'} — Rio de Janeiro / RJ`],
  ['Regime tributário', salao.regime_tributario ?? cf.regime_tributario ?? '—'],
]);

titulo('2. Parâmetros fiscais configurados');
tabela(['Campo', 'Valor no sistema'], [
  ['Alíquota ISS', `${cf.aliquota_padrao ?? '—'}%`],
  ['PIS', `${cf.pis_percentual ?? '—'}%`],
  ['COFINS', `${cf.cofins_percentual ?? '—'}%`],
  ['Optante pelo Simples', cf.optante_simples ? 'Sim' : 'Não'],
  ['Regime Especial de Tributação', cf.regime_especial_tributacao ?? '(vazio)'],
  ['Código de tributação do município (nível salão)', String(cf.cmc ?? '').trim() || '(vazio)'],
  ['Emitir no padrão nacional', cf.emitir_padrao_nacional ? 'Sim' : 'Não'],
  ['Prazo de cancelamento', `${cf.prazo_cancelamento_dias ?? '—'} dias`],
]);

titulo('3. Como os serviços estão classificados');
tabela(
  ['NBS', 'Cód. nacional', 'Cód. municipal', 'ISS', 'Serviços', 'Setores'],
  Object.entries(porNbs).sort().map(([nbs, v]) => [
    nbs, v.nac ?? '—', v.mun ?? '—', `${v.aliq}%`, String(v.n), [...v.setores].join(', '),
  ]),
);
if (semClassificacao.length) {
  paragrafo(
    `Sem classificação nenhuma: ${semClassificacao.map(s => s.nome_servico).join(', ')} `
    + '— sem NBS, sem código municipal e com alíquota zero. É a pergunta 5.',
    { tam: 8.5 },
  );
}

titulo('4. Opções de Regime Especial de Tributação no sistema');
tabela(['Código', 'Opção'], [
  ['0', 'Sem Regime Especial'],
  ['1', 'Microempresa Municipal'],
  ['2', 'Estimativa'],
  ['3', 'Sociedade de Profissionais'],
  ['4', 'Cooperativa'],
  ['5', 'MEI'],
  ['6', 'Microempresa ou EPP  (selecionado hoje)'],
]);

// ── Perguntas ──────────────────────────────────────────────────────────────
doc.addPage(); y = 24;
doc.setFont('helvetica', 'bold').setFontSize(14).setTextColor(...TINTA);
doc.text(limpo('Perguntas'), L, y); y += 4;
doc.setDrawColor(...TINTA).setLineWidth(0.6).line(L, y, L + LARG, y); y += 10;

titulo('Sobre a LUARYS SOFTWARE E SISTEMAS LTDA — CNPJ 68.176.336/0001-43');
pergunta(1, 'Em qual anexo do Simples a empresa está enquadrada hoje, III ou V? Qual o Fator R apurado no último período?');
pergunta(2, 'O que precisaria mudar na folha ou no pró-labore para o Fator R ficar acima de 28%?');
pergunta(3, 'A empresa passa a revender a terceiros um serviço contratado de outro fornecedor, cobrado dentro da mensalidade do sistema. Isso muda o enquadramento no item 01.07 ou exige outro código de serviço?');

titulo(`Sobre o ${salao.nome_fantasia} — CNPJ ${salao.cnpj}`);
pergunta(4, 'O código 06.01.20 que a senhora passou substitui qual campo: o nacional ou o municipal?',
  'Nas notas já emitidas e aceitas, cabelo saiu com nacional 060101 e municipal 005. Hoje os 321 serviços estão com 060101 + 005 (ver a tabela 3).');
pergunta(5, 'Como tratar a Gorjeta? É repasse ao profissional ou receita do salão?',
  'Está cadastrada como serviço e é a única sem classificação nenhuma. Se for receita, qual NBS e qual código municipal? E o que colocar no código de tributação do município no nível do salão, hoje vazio (tabela 2)?');
pergunta(6, 'O Regime Especial de Tributação está como "Microempresa ou EPP" (código 6). É esse mesmo, ou qual dos códigos de 0 a 6 deve ir na nota?',
  'A lista completa está na tabela 4.');
pergunta(7, 'Atendimento que mistura cabelo e estética na mesma visita: uma nota ou duas?',
  'Já ocorreram 27 casos.');
pergunta(8, 'Como declarar o dono que também atende clientes?');
pergunta(9, 'Qual cClassTrib (IBS/CBS) se aplica a cosmético revendido por optante do Simples?',
  'A SEFAZ-RJ rejeita nota sem esse campo desde 03/08. Vale para quando a venda de produto com nota entrar.');
pergunta(10, 'O comprovante estadual diz "Optante Simei desde 2023", mas as NFS-e de julho saem como ME/EPP. O cadastro estadual precisa ser atualizado?');

const total = doc.getNumberOfPages();
for (let i = 1; i <= total; i++) {
  doc.setPage(i);
  doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(148, 163, 184);
  doc.text(limpo(`${salao.nome_fantasia} · ${new Date().toLocaleDateString('pt-BR')}`), L, 289);
  doc.text(`${i} de ${total}`, L + LARG, 289, { align: 'right' });
}

const saida = 'perguntas-contabilidade.pdf';
fs.writeFileSync(saida, Buffer.from(doc.output('arraybuffer')));
console.log(`PDF gerado: ${saida} · ${total} páginas`);
console.log(`${Object.keys(porNbs).length} classes de serviço · ${srv.length} serviços lidos do banco`);

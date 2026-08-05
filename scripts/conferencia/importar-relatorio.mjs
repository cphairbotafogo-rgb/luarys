/**
 * Importa atendimentos de um relatório de comissão de outra plataforma.
 *
 *   node scripts/conferencia/importar-relatorio.mjs <arquivo.json> [--aplicar]
 *
 * Sem --aplicar roda em modo seco: mostra exatamente o que faria e não grava
 * nada. É assim que se usa na primeira vez, sempre.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE ESTE SCRIPT EXISTE
 *
 * Na conferência de julho/2026 descobrimos que importar esses relatórios "no
 * olho" produz duplicata silenciosa. Cada regra abaixo veio de um erro real que
 * quase foi cometido — não são precauções teóricas.
 *
 * 1. DIA OCUPADO NÃO É TOCADO.
 *    Só entram dias em que NENHUM profissional do salão tem lançamento. Parece
 *    conservador demais, mas foi o que evitou o pior caso: serviços da Luciene
 *    estavam lançados no Ari por erro de atribuição na migração. Como ela não
 *    tinha nada naquele dia, uma regra "por profissional" teria inserido os
 *    mesmos atendimentos de novo — o salão passaria a faturar duas vezes o
 *    mesmo corte.
 *
 * 2. O VALOR VEM DO RELATÓRIO, NUNCA DO CATÁLOGO.
 *    Preço cobrado e preço de tabela divergem com frequência (desconto, valor
 *    combinado, serviço promocional). Quando diferem, o agendamento é marcado
 *    com preco_editado_manualmente para o sistema não tratar como inconsistência.
 *
 * 3. CLIENTE É PROCURADO, NÃO CRIADO À TOA.
 *    Busca por nome_completo normalizado (sem acento, sem caixa, sem
 *    pontuação). Só cria quem realmente não existe, e avisa quais criou.
 *
 * 4. UM LANÇAMENTO DE CAIXA POR VISITA, NÃO POR SERVIÇO.
 *    Cliente que fez três serviços no mesmo dia gera UM fechamento, como
 *    aconteceria na operação real. Um por serviço infla a contagem de vendas.
 *
 * 5. SERVIÇO SEM RECEITA NÃO GERA NOTA.
 *    Valor zero (pacote já pago, cortesia, avaliação) entra na agenda e na
 *    comissão, mas não vira nota fiscal — a prefeitura recusa por regra.
 *
 * 6. A DATA DO ATENDIMENTO É A COMPETÊNCIA.
 *    data_movimentacao recebe a data do serviço, não a de hoje. É ela que a
 *    NFS-e usa como competência do ISS.
 *
 * 7. RODAR DUAS VEZES NÃO DUPLICA.
 *    Todo lançamento leva a marca MARCA_IMPORTACAO no comentário. Se ela já
 *    existir para o período, o script recusa executar.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FORMATO DO ARQUIVO DE ENTRADA
 *
 * {
 *   "salao": "Concept Prime Hair",
 *   "periodo": "2026-08",
 *   "atendimentos": [
 *     ["2026-08-03", "Luciene Cavalcanti", "Maria Silva", "Escova Prime", 95, 73.57, "Cartão Crédito"]
 *   ]
 * }
 *
 * Colunas: data | profissional | cliente | serviço | valor | comissão | forma
 * Formas aceitas: PIX, DINHEIRO, Cartão Crédito, Cartão Débito, Outros
 */
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const MARCA_IMPORTACAO = 'importacao-relatorio-externo';

const arquivo = process.argv[2];
const aplicar = process.argv.includes('--aplicar');
if (!arquivo) {
  console.error('uso: node scripts/conferencia/importar-relatorio.mjs <arquivo.json> [--aplicar]');
  process.exit(1);
}

const env = {};
fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).forEach(l => {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
});
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const norm = x => String(x ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]/g, '');

const paginado = async (tabela, colunas, filtro = q => q) => {
  let todos = [], de = 0;
  for (;;) {
    const { data, error } = await filtro(db.from(tabela).select(colunas)).range(de, de + 999);
    if (error) throw new Error(`${tabela}: ${error.message}`);
    if (!data?.length) break;
    todos = todos.concat(data);
    if (data.length < 1000) break;
    de += 1000;
  }
  return todos;
};

const entrada = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
const LINHAS = entrada.atendimentos ?? [];

console.log(`\n${aplicar ? 'APLICANDO' : 'SIMULAÇÃO (nada será gravado)'} — ${arquivo}`);
console.log(`${LINHAS.length} atendimentos no relatório\n`);

const { data: salao } = await db.from('saloes').select('id').eq('nome_fantasia', entrada.salao).maybeSingle();
if (!salao) { console.error(`salão "${entrada.salao}" não encontrado`); process.exit(1); }
const SID = salao.id;

// ── Regra 7: já importado? ───────────────────────────────────────────────────
const datas = [...new Set(LINHAS.map(l => l[0]))].sort();
const { count: jaImportado } = await db.from('financeiro')
  .select('id', { count: 'exact', head: true })
  .eq('salao_id', SID).like('comentario', `%${MARCA_IMPORTACAO}%`)
  .gte('data_movimentacao', datas[0]).lte('data_movimentacao', datas.at(-1) + 'T23:59:59');
if (jaImportado) {
  console.error(`ABORTADO: já existem ${jaImportado} lançamentos importados neste período.`);
  console.error('Apague-os antes de reimportar, ou ajuste o período do arquivo.');
  process.exit(1);
}

// ── Carrega cadastros ────────────────────────────────────────────────────────
const profs = await paginado('profissionais', 'id,nome', q => q.eq('salao_id', SID));
const servs = await paginado('servicos', 'id,nome_servico,preco_padrao,codigo_tributacao_nacional,codigo_municipio,aliquota_iss,nbs', q => q.eq('salao_id', SID));
let clientes = await paginado('clientes', 'id,nome_completo', q => q.eq('salao_id', SID));
const ocupados = new Set(
  (await paginado('comissoes', 'data_evento', q => q
    .eq('salao_id', SID).gte('data_evento', datas[0]).lte('data_evento', datas.at(-1))))
    .map(r => r.data_evento));

const acharProf = n => profs.find(p => norm(p.nome) === norm(n)) ?? profs.find(p => norm(p.nome).includes(norm(n)));
const acharServ = n => servs.find(x => norm(x.nome_servico) === norm(n));
const acharCli = n => clientes.find(c => norm(c.nome_completo) === norm(n));

// ── Regra 1: descarta dias já ocupados ───────────────────────────────────────
const diasOcupados = datas.filter(d => ocupados.has(d));
const linhas = LINHAS.filter(l => !ocupados.has(l[0]));
if (diasOcupados.length) {
  console.log(`Dias ignorados por já terem lançamento no sistema (${diasOcupados.length}):`);
  console.log(`   ${diasOcupados.join(', ')}`);
  console.log('   → confira esses dias manualmente; podem ter atendimentos faltando.\n');
}
if (!linhas.length) { console.log('Nada a importar.'); process.exit(0); }

// ── Resolve cadastros e aponta o que falta ───────────────────────────────────
const semServico = [...new Set(linhas.filter(l => !acharServ(l[3])).map(l => l[3]))];
const semProf = [...new Set(linhas.filter(l => !acharProf(l[1])).map(l => l[1]))];
if (semServico.length || semProf.length) {
  if (semServico.length) console.error('Serviços não encontrados no catálogo:\n   ' + semServico.join('\n   '));
  if (semProf.length) console.error('Profissionais não encontrados:\n   ' + semProf.join('\n   '));
  console.error('\nCadastre-os antes de importar. Nada foi gravado.');
  process.exit(1);
}

const clientesNovos = [...new Set(linhas.filter(l => !acharCli(l[2])).map(l => l[2]))];
const editados = linhas.filter(l => Math.abs(Number(acharServ(l[3]).preco_padrao) - l[4]) > 0.005);

console.log(`A importar: ${linhas.length} atendimentos | R$ ${linhas.reduce((a, l) => a + l[4], 0).toFixed(2)}`);
console.log(`Clientes a criar: ${clientesNovos.length}${clientesNovos.length ? ' → ' + clientesNovos.join(', ') : ''}`);
console.log(`Preço diferente do catálogo: ${editados.length} (serão marcados como preço editado)`);

const visitas = {};
linhas.forEach(l => { (visitas[l[0] + '|' + l[2]] ??= []).push(l); });
const comNota = Object.values(visitas).filter(i => i.reduce((a, x) => a + x[4], 0) > 0);
console.log(`Lançamentos no caixa: ${Object.keys(visitas).length} | Notas pendentes: ${comNota.length}\n`);

if (!aplicar) {
  console.log('Simulação concluída. Rode de novo com --aplicar para gravar.');
  process.exit(0);
}

// ── Grava ────────────────────────────────────────────────────────────────────
if (clientesNovos.length) {
  // telefone_whatsapp é NOT NULL; entra vazio para o salão completar depois.
  const { data, error } = await db.from('clientes').insert(clientesNovos.map(nome => ({
    salao_id: SID, nome_completo: nome, telefone_whatsapp: '', ativo: true,
    observacoes: `Criado na importação de relatório (${entrada.periodo ?? ''}) — completar contato.`,
  }))).select('id,nome_completo');
  if (error) { console.error('ERRO ao criar clientes:', error.message); process.exit(1); }
  clientes = clientes.concat(data);
  console.log(`clientes criados: ${data.length}`);
}

const hora = {};
const ags = linhas.map(l => {
  const [dia, prof, cliente, serv, val, com] = l;
  const k = dia + '|' + prof;
  hora[k] = (hora[k] ?? 8) + 1;
  const h = String(Math.min(hora[k], 20)).padStart(2, '0') + ':00:00';
  return {
    salao_id: SID, cliente_id: acharCli(cliente).id, profissional_id: acharProf(prof).id,
    servico_id: acharServ(serv).id, cliente_nome: cliente, data: dia, inicio: h,
    data_hora_inicio: `${dia}T${h}-03:00`, status: 'Finalizado', valor_final: val,
    valor_comissao: com, comissao_paga: false, duracao_min: 60, cor: '#4F9D6E',
    preco_editado_manualmente: Math.abs(Number(acharServ(serv).preco_padrao) - val) > 0.005,
    observacao: MARCA_IMPORTACAO,
  };
});
const { data: agIns, error: eAg } = await db.from('agendamentos').insert(ags).select('id,data,cliente_nome,servico_id');
if (eAg) { console.error('ERRO agendamentos:', eAg.message); process.exit(1); }
console.log(`agendamentos: ${agIns.length}`);

const usados = new Set();
linhas.forEach(l => {
  const i = agIns.findIndex((a, idx) => !usados.has(idx) && a.data === l[0]
    && a.cliente_nome === l[2] && a.servico_id === acharServ(l[3]).id);
  if (i >= 0) { usados.add(i); l.agendamento_id = agIns[i].id; }
});

const zerado = { pix: 0, cheque: 0, debito: 0, credito: 0, prePago: 0, dinheiro: 0 };
const campoPg = { 'PIX': 'pix', 'DINHEIRO': 'dinheiro', 'Cartão Débito': 'debito', 'Cartão Crédito': 'credito' };
const fins = Object.entries(visitas).map(([, itens]) => {
  const total = itens.reduce((a, x) => a + x[4], 0);
  const forma = itens[0][6] ?? 'Outros';
  const pagamentos = { ...zerado };
  if (campoPg[forma]) pagamentos[campoPg[forma]] = total;
  return {
    salao_id: SID, cliente_nome: itens[0][2], descricao: `Fechamento de Conta - ${itens[0][2]}`,
    tipo: 'entrada', categoria: 'Serviços Prestados', valor: total, status: 'Pago',
    forma_pagamento: forma, metodo_pagamento: forma,
    profissional_nome: acharProf(itens[0][1]).nome,
    data_movimentacao: `${itens[0][0]}T15:00:00+00:00`, pagamentos,
    agendamento_ids: itens.map(x => x.agendamento_id).filter(Boolean),
    comentario: `Importado — ${MARCA_IMPORTACAO}`,
  };
});
const { data: finIns, error: eFin } = await db.from('financeiro').insert(fins).select('id,cliente_nome,data_movimentacao');
if (eFin) { console.error('ERRO financeiro:', eFin.message); process.exit(1); }
console.log(`caixa: ${finIns.length} | R$ ${fins.reduce((a, f) => a + f.valor, 0).toFixed(2)}`);

const { data: cIns, error: eCom } = await db.from('comissoes').insert(linhas.map(l => ({
  salao_id: SID, id_prof: acharProf(l[1]).id, profissional_id: acharProf(l[1]).id,
  agendamento_id: l.agendamento_id ?? null, status: 'Pendente', servico_nome: l[3],
  valor_servico: l[4], valor_comissao: l[5], data_evento: l[0],
  porcentagem_comissao: l[4] > 0 ? Math.round((l[5] / l[4]) * 10000) / 100 : 0,
}))).select('id');
if (eCom) { console.error('ERRO comissoes:', eCom.message); process.exit(1); }
console.log(`comissões: ${cIns.length}`);

const notas = [];
for (const itens of Object.values(visitas)) {
  const total = itens.reduce((a, x) => a + x[4], 0);
  if (total <= 0) continue;                       // Regra 5
  const dia = itens[0][0], cliente = itens[0][2];
  const sv = acharServ(itens[0][3]);
  const prof = acharProf(itens[0][1]);
  const { data: p } = await db.from('profissionais').select('cnpj_mei,tipo_parceiro').eq('id', prof.id).maybeSingle();
  const cota = itens.reduce((a, x) => a + x[5], 0);
  notas.push({
    salao_id: SID,
    financeiro_id: finIns.find(f => f.cliente_nome === cliente && String(f.data_movimentacao).slice(0, 10) === dia)?.id ?? null,
    cliente_nome: cliente, descricao_servico: itens.map(x => x[3]).join(', '),
    valor: total, status: 'Não Emitido',
    item_lista_servico: sv.codigo_tributacao_nacional, codigo_tributacao_municipio: sv.codigo_municipio,
    aliquota_iss: sv.aliquota_iss, nbs: sv.nbs,
    data_movimentacao: `${dia}T15:00:00+00:00`,   // Regra 6
    profissional_nome: prof.nome, cnpj_profissional: p?.cnpj_mei ?? null,
    tipo_parceiro: p?.tipo_parceiro ?? null,
    valor_cota_profissional: cota, valor_cota_salao: Math.round((total - cota) * 100) / 100,
  });
}
const { data: nIns, error: eNota } = await db.from('notas_fiscais').insert(notas).select('id');
if (eNota) { console.error('ERRO notas:', eNota.message); process.exit(1); }
console.log(`notas fiscais pendentes: ${nIns.length}`);

console.log('\nConcluído. Confira o total por profissional contra o relatório original.');

/**
 * Remove atendimentos importados que duplicam um lançamento pré-existente.
 *
 * Um duplicado é: agendamento com a marca da importação que tem, no MESMO dia,
 * para o MESMO cliente e o MESMO serviço, um gêmeo criado antes da importação.
 * A comparação é feita por par — dois cortes iguais no mesmo dia só viram
 * duplicata se existirem dois gêmeos antigos.
 *
 * A visita (dia + cliente) pode misturar serviço duplicado e serviço legítimo.
 * Por isso o caixa e a nota são tratados em três casos:
 *   INTEIRA  — todos os serviços da visita são duplicados → apaga caixa e nota.
 *   PARCIAL  — só parte → abate o valor no caixa e na nota, mantendo o resto.
 *   INTACTA  — nenhum duplicado → não toca.
 *
 * Sem --aplicar, só imprime o que faria. Backup em JSON antes de qualquer
 * escrita, sempre.
 *
 * O nome do serviço diverge entre sistemas (a migração renomeou vários, e alguns
 * foram apagados do catálogo), então o casamento por nome não pega tudo. Quando
 * for esse o caso, gere a lista com parear-por-relatorio.mjs — que decide pelo
 * valor cobrado dentro do dia, seguindo o relatório — e passe o arquivo aqui com
 * --ids. O tratamento de caixa e nota é o mesmo nos dois caminhos.
 *
 * Uso: node scripts/conferencia/limpar-duplicados.mjs <ini> <fim> [--ids <arq>] [--aplicar]
 *   node scripts/conferencia/limpar-duplicados.mjs 2026-06-01 2026-06-30
 *   node scripts/conferencia/limpar-duplicados.mjs 2026-06-01 2026-06-30 --ids scripts/conferencia/pareamento-2026-06.json --aplicar
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const argv = process.argv.slice(2);
const iIds = argv.indexOf('--ids');
const ARQ_IDS = iIds >= 0 ? argv[iIds + 1] : null;
const [INI, FIM] = argv.filter((a, i) => !a.startsWith('--') && i !== iIds + 1);
const APLICAR = argv.includes('--aplicar');
if (!INI || !FIM) { console.error('uso: limpar-duplicados.mjs <ini> <fim> [--ids <arq>] [--aplicar]'); process.exit(1); }

const MARCA = 'importacao-relatorio-externo';
const SALAO = 'Concept Prime Hair';

const env = {};
for (const l of fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const norm = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const cent = (n) => Math.round(n * 100) / 100;

async function pag(tab, sel, f) {
  const out = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await f(db.from(tab).select(sel)).range(de, de + 999);
    if (error) throw new Error(`${tab}: ${error.message}`);
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

const { data: sal } = await db.from('saloes').select('id').eq('nome_fantasia', SALAO).maybeSingle();
if (!sal) { console.error(`salão "${SALAO}" não encontrado`); process.exit(1); }
const SID = sal.id;

const clis = await pag('clientes', 'id,nome_completo', (q) => q.eq('salao_id', SID));
const nc = Object.fromEntries(clis.map((x) => [x.id, x.nome_completo]));
const servs = await pag('servicos', 'id,nome_servico', (q) => q.eq('salao_id', SID));
const ns = Object.fromEntries(servs.map((x) => [x.id, x.nome_servico]));

const ag = await pag('agendamentos', 'id,data,valor_final,cliente_id,servico_id,observacao,created_at', (q) =>
  q.eq('salao_id', SID).gte('data', INI).lte('data', FIM));

// ── identifica duplicados, pareando importado com pré-existente ──────────────
const grupos = new Map();
for (const r of ag) {
  const k = `${r.data}|${norm(nc[r.cliente_id])}|${norm(ns[r.servico_id])}`;
  if (!grupos.has(k)) grupos.set(k, []);
  grupos.get(k).push(r);
}
let dupes;
if (ARQ_IDS) {
  const lista = JSON.parse(fs.readFileSync(path.resolve(ARQ_IDS), 'utf8'));
  const alvo = new Set((lista.remover ?? lista).map((r) => r.id ?? r));
  dupes = ag.filter((a) => alvo.has(a.id));
  const faltando = alvo.size - dupes.length;
  console.log(`\nlista externa: ${alvo.size} IDs` + (faltando ? ` (${faltando} não estão no período — ignorados)` : ''));
} else {
  dupes = [];
  for (const [, v] of grupos) {
    const imp = v.filter((x) => String(x.observacao || '').includes(MARCA));
    const pre = v.filter((x) => !String(x.observacao || '').includes(MARCA));
    dupes.push(...imp.slice(0, Math.min(pre.length, imp.length)));
  }
}
const naoImportado = dupes.filter((d) => !String(d.observacao || '').includes(MARCA));
if (naoImportado.length) {
  console.error(`\nABORTADO: ${naoImportado.length} dos registros indicados não vieram da importação.`);
  console.error('A limpeza só remove o que a importação criou — nunca lançamento do salão.');
  process.exit(1);
}
const idsDup = new Set(dupes.map((d) => d.id));

console.log(`\nduplicados encontrados: ${dupes.length} · R$ ${dupes.reduce((a, d) => a + (+d.valor_final || 0), 0).toFixed(2)}`);
if (!dupes.length) { console.log('nada a fazer.'); process.exit(0); }

// ── comissões ────────────────────────────────────────────────────────────────
const com = await pag('comissoes', 'id,agendamento_id,valor_comissao,data_evento,servico_nome', (q) =>
  q.eq('salao_id', SID).gte('data_evento', INI).lte('data_evento', FIM));
const comDup = com.filter((c) => idsDup.has(c.agendamento_id));

// ── caixa e notas, visita a visita ───────────────────────────────────────────
const fin = await pag('financeiro', 'id,valor,cliente_nome,data_movimentacao,agendamento_ids,comentario', (q) =>
  q.eq('salao_id', SID).like('comentario', `%${MARCA}%`).gte('data_movimentacao', INI).lte('data_movimentacao', `${FIM}T23:59:59`));
const nf = await pag('notas_fiscais', 'id,financeiro_id,valor,status,descricao_servico,cliente_nome,numero_nota,valor_cota_profissional,valor_cota_salao', (q) =>
  q.eq('salao_id', SID).gte('data_movimentacao', INI).lte('data_movimentacao', `${FIM}T23:59:59`));
const notaDe = Object.fromEntries(nf.filter((n) => n.financeiro_id).map((n) => [n.financeiro_id, n]));

const finApagar = [], finAbater = [], nfApagar = [], nfAbater = [];
for (const f of fin) {
  const ids = Array.isArray(f.agendamento_ids) ? f.agendamento_ids : [];
  const seus = ag.filter((a) => ids.includes(a.id));
  const dups = seus.filter((a) => idsDup.has(a.id));
  if (!dups.length) continue;
  const nota = notaDe[f.id];
  if (dups.length === seus.length) {
    finApagar.push(f);
    if (nota) nfApagar.push(nota);
  } else {
    const abate = cent(dups.reduce((a, d) => a + (+d.valor_final || 0), 0));
    const restam = seus.filter((a) => !idsDup.has(a.id));
    finAbater.push({ f, abate, novoValor: cent((+f.valor || 0) - abate), idsRestantes: restam.map((a) => a.id) });
    if (nota) nfAbater.push({ nota, abate, novoValor: cent((+nota.valor || 0) - abate), descricao: restam.map((a) => ns[a.servico_id]).join(', ') });
  }
}

console.log(`comissões a apagar:   ${comDup.length} · R$ ${comDup.reduce((a, c) => a + (+c.valor_comissao || 0), 0).toFixed(2)}`);
console.log(`caixa a apagar:       ${finApagar.length} · R$ ${finApagar.reduce((a, f) => a + (+f.valor || 0), 0).toFixed(2)}`);
console.log(`caixa a abater:       ${finAbater.length} · R$ ${finAbater.reduce((a, x) => a + x.abate, 0).toFixed(2)}`);
console.log(`notas a apagar:       ${nfApagar.length} (${nfApagar.filter((n) => n.status === 'Emitida').length} já emitidas em homologação)`);
console.log(`notas a abater:       ${nfAbater.length} (${nfAbater.filter((x) => x.nota.status === 'Emitida').length} já emitidas em homologação)`);

console.log('\n— visitas com abate parcial —');
for (const x of finAbater) {
  console.log(`   ${String(x.f.data_movimentacao).slice(0, 10)}  ${String(x.f.cliente_nome).padEnd(30)} R$ ${(+x.f.valor).toFixed(2)} → R$ ${x.novoValor.toFixed(2)}  (−${x.abate.toFixed(2)})`);
}

const backup = {
  gerado_em: new Date().toISOString(), periodo: [INI, FIM],
  agendamentos: dupes, comissoes: comDup,
  financeiro_apagados: finApagar,
  financeiro_abatidos: finAbater.map((x) => ({ id: x.f.id, valor_antes: x.f.valor, valor_depois: x.novoValor, agendamento_ids_antes: x.f.agendamento_ids })),
  notas_apagadas: nfApagar,
  notas_abatidas: nfAbater.map((x) => ({ id: x.nota.id, valor_antes: x.nota.valor, valor_depois: x.novoValor, descricao_antes: x.nota.descricao_servico, descricao_depois: x.descricao, status: x.nota.status })),
};
// Carimbo de tempo no nome, sempre. Com nome fixo, a simulação de uma segunda
// limpeza sobrescreve o backup da primeira — perdi assim o backup de uma remoção
// já aplicada em 05/08/2026.
const carimbo = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const arq = path.join(process.cwd(), `scripts/conferencia/backup-limpeza-${INI}_${FIM}-${carimbo}.json`);
fs.writeFileSync(arq, JSON.stringify(backup, null, 1));
console.log(`\nbackup: ${arq}`);

if (!APLICAR) { console.log('\n(simulação — rode com --aplicar para gravar)'); process.exit(0); }

// ── escrita ─────────────────────────────────────────────────────────────────
const lotes = (a, n = 100) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
const ok = (r, o) => { if (r.error) { console.error(`ERRO ${o}: ${r.error.message}`); process.exit(1); } };

for (const l of lotes(nfApagar.map((n) => n.id))) ok(await db.from('notas_fiscais').delete().in('id', l), 'notas');
for (const x of nfAbater) {
  ok(await db.from('notas_fiscais').update({
    valor: x.novoValor, descricao_servico: x.descricao,
    valor_cota_salao: cent(x.novoValor - (+x.nota.valor_cota_profissional || 0)),
  }).eq('id', x.nota.id), 'nota abatida');
}
for (const l of lotes(comDup.map((c) => c.id))) ok(await db.from('comissoes').delete().in('id', l), 'comissoes');
for (const l of lotes(finApagar.map((f) => f.id))) ok(await db.from('financeiro').delete().in('id', l), 'financeiro');
for (const x of finAbater) {
  ok(await db.from('financeiro').update({ valor: x.novoValor, agendamento_ids: x.idsRestantes }).eq('id', x.f.id), 'financeiro abatido');
}
for (const l of lotes([...idsDup])) ok(await db.from('agendamentos').delete().in('id', l), 'agendamentos');

console.log('\naplicado.');

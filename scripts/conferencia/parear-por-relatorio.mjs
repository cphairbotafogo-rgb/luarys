/**
 * Decide o que é duplicata olhando o RELATÓRIO, não o nome do serviço.
 *
 * O nome do serviço diverge entre os dois sistemas (a migração renomeou vários,
 * e alguns foram apagados do catálogo). Já o valor cobrado é o mesmo nos dois.
 * E cliente que repete o mesmo serviço em dias diferentes é normal — por isso a
 * comparação é sempre dentro de UM dia, para UM cliente.
 *
 * Para cada (dia, cliente) que aparece no relatório:
 *   relatório  = os valores que aquele cliente pagou naquele dia, segundo o PDF
 *   pré-existente = o que já estava no Luarys antes da importação
 *   importado  = o que a importação inseriu
 *
 * Se pré-existente já cobre uma linha do relatório (mesmo valor), o importado
 * correspondente é duplicata e sai. O que sobra do relatório sem cobertura é
 * atendimento que o Luarys realmente não tinha — fica.
 *
 * Uso: node scripts/conferencia/parear-por-relatorio.mjs <mês> [--aplicar]
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const MES = process.argv[2];
const APLICAR = process.argv.includes('--aplicar');
if (!MES) { console.error('uso: parear-por-relatorio.mjs 2026-06 [--aplicar]'); process.exit(1); }

const MARCA = 'importacao-relatorio-externo';
const env = {};
for (const l of fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const norm = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const v2 = (n) => (Math.round((+n || 0) * 100) / 100).toFixed(2);

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

// ── relatório ────────────────────────────────────────────────────────────────
const dir = path.join(process.cwd(), 'scripts/conferencia/dados');
const rel = [];
let salaoNome = null;
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
  const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  if (j.periodo !== MES) continue;
  salaoNome = j.salao;
  for (const [data, prof, cliente, servico, valor] of j.atendimentos) rel.push({ data, prof, cliente, servico, valor: +valor });
}
if (!rel.length) { console.error(`sem relatório para ${MES}`); process.exit(1); }

const { data: sal } = await db.from('saloes').select('id').eq('nome_fantasia', salaoNome).maybeSingle();
const SID = sal.id;
const clis = await pag('clientes', 'id,nome_completo', (q) => q.eq('salao_id', SID));
const nc = Object.fromEntries(clis.map((x) => [x.id, x.nome_completo]));
const servs = await pag('servicos', 'id,nome_servico', (q) => q.eq('salao_id', SID));
const ns = Object.fromEntries(servs.map((x) => [x.id, x.nome_servico]));

const [y, m] = MES.split('-').map(Number);
const fim = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
const ag = await pag('agendamentos', 'id,data,valor_final,cliente_id,servico_id,observacao', (q) =>
  q.eq('salao_id', SID).gte('data', `${MES}-01`).lte('data', fim));

// ── pareamento por (dia, cliente) ────────────────────────────────────────────
const chave = (d, c) => `${d}|${norm(c)}`;
const doRel = new Map();
for (const r of rel) {
  const k = chave(r.data, r.cliente);
  if (!doRel.has(k)) doRel.set(k, []);
  doRel.get(k).push(r);
}

const remover = [], manter = [];
const relato = [];
for (const [k, linhas] of doRel) {
  const [dia] = k.split('|');
  const doDia = ag.filter((a) => chave(a.data, nc[a.cliente_id]) === k);
  const pre = doDia.filter((a) => !String(a.observacao || '').includes(MARCA));
  const imp = doDia.filter((a) => String(a.observacao || '').includes(MARCA));
  if (!imp.length || !pre.length) { manter.push(...imp); continue; }

  // cada valor pré-existente cobre UMA linha do relatório
  const disponiveis = pre.map((p) => v2(p.valor_final));
  const cobertos = [];
  for (const l of linhas) {
    const i = disponiveis.indexOf(v2(l.valor));
    if (i >= 0) { disponiveis.splice(i, 1); cobertos.push(v2(l.valor)); }
  }
  // remove do importado um registro por linha coberta
  const sobra = [...cobertos];
  for (const a of imp) {
    const i = sobra.indexOf(v2(a.valor_final));
    if (i >= 0) { sobra.splice(i, 1); remover.push(a); } else manter.push(a);
  }
  relato.push({
    dia, cliente: linhas[0].cliente,
    rel: linhas.map((l) => `${l.servico} ${v2(l.valor)}`),
    pre: pre.map((p) => `${ns[p.servico_id] ?? '(apagado)'} ${v2(p.valor_final)}`),
    sai: imp.filter((a) => remover.includes(a)).map((a) => `${ns[a.servico_id]} ${v2(a.valor_final)}`),
    fica: imp.filter((a) => manter.includes(a)).map((a) => `${ns[a.servico_id]} ${v2(a.valor_final)}`),
  });
}

console.log(`\n${MES} — pareamento por relatório\n`);
for (const r of relato.sort((a, b) => a.dia.localeCompare(b.dia))) {
  console.log(`${r.dia.slice(5)}  ${r.cliente}`);
  console.log(`   relatório: ${r.rel.join(' | ')}`);
  console.log(`   já havia:  ${r.pre.join(' | ')}`);
  if (r.sai.length) console.log(`   SAI:       ${r.sai.join(' | ')}`);
  if (r.fica.length) console.log(`   fica:      ${r.fica.join(' | ')}`);
  console.log();
}
console.log(`a remover: ${remover.length} · R$ ${remover.reduce((a, x) => a + (+x.valor_final || 0), 0).toFixed(2)}`);
console.log(`a manter:  ${manter.length} · R$ ${manter.reduce((a, x) => a + (+x.valor_final || 0), 0).toFixed(2)}`);

fs.writeFileSync(path.join(process.cwd(), `scripts/conferencia/pareamento-${MES}.json`), JSON.stringify({ remover, manter }, null, 1));
if (!APLICAR) { console.log('\n(simulação — use --aplicar depois de conferir)'); process.exit(0); }
console.log('\nIDs para remoção gravados. Use limpar-duplicados.mjs ou remova pelos IDs do arquivo.');

/**
 * Detalha um mês dia a dia: relatório x Luarys, e aponta duplicatas reais.
 * Uso: node scripts/conferencia/detalhar-mes.mjs 2026-06
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const MES = process.argv[2];
if (!MES) { console.error('informe o mês: 2026-06'); process.exit(1); }

const RAIZ = process.cwd();
const env = {};
for (const l of fs.readFileSync(path.join(RAIZ, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const norm = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

const { data: sal } = await s.from('saloes').select('id').eq('nome_fantasia', 'Concept Prime Hair').maybeSingle();

const dir = path.join(RAIZ, 'scripts/conferencia/dados');
const orig = [];
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
  const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  if (j.periodo !== MES) continue;
  for (const [data, prof, cliente, servico, valor] of j.atendimentos) orig.push({ data, prof, cliente, servico, valor: +valor });
}

const [y, m] = MES.split('-').map(Number);
const fim = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
const { data: profs } = await s.from('profissionais').select('id,nome');
const nomeProf = Object.fromEntries((profs || []).map((p) => [p.id, String(p.nome).trim()]));
const { data: servs } = await s.from('servicos').select('id,nome_servico').eq('salao_id', sal.id);
const nomeServ = Object.fromEntries((servs || []).map((x) => [x.id, x.nome_servico]));
const { data: clis } = await s.from('clientes').select('id,nome_completo').eq('salao_id', sal.id);
const nomeCli = Object.fromEntries((clis || []).map((x) => [x.id, x.nome_completo]));

const luarys = [];
for (let de = 0; ; de += 1000) {
  const { data, error } = await s.from('agendamentos')
    .select('id,data,valor_final,profissional_id,servico_id,cliente_id,observacao')
    .eq('salao_id', sal.id).gte('data', `${MES}-01`).lte('data', fim).order('data').range(de, de + 999);
  if (error) throw error;
  luarys.push(...(data || []));
  if (!data || data.length < 1000) break;
}

const MARCA = 'importacao-relatorio-externo';
const dias = [...new Set([...orig.map((o) => o.data), ...luarys.map((l) => l.data)])].sort();

console.log(`\n${MES} — dia a dia\n`);
console.log('dia    relat.  Luarys  (import / outros)   valor relat.   valor Luarys   origem');
let totO = 0, totL = 0;
for (const d of dias) {
  const o = orig.filter((x) => x.data === d);
  const l = luarys.filter((x) => x.data === d);
  const imp = l.filter((x) => String(x.observacao || '').includes(MARCA));
  const vo = o.reduce((a, x) => a + x.valor, 0);
  const vl = l.reduce((a, x) => a + (+x.valor_final || 0), 0);
  totO += vo; totL += vl;
  const origem = !o.length ? 'só Luarys (fora do relatório)'
    : imp.length === l.length ? 'importado'
    : imp.length === 0 ? 'migração (relatório ignorado)'
    : 'MISTO — verificar';
  console.log(
    d.slice(8).padEnd(6) +
    String(o.length).padStart(5) + String(l.length).padStart(8) +
    `   (${imp.length}/${l.length - imp.length})`.padEnd(14) +
    vo.toFixed(2).padStart(12) + vl.toFixed(2).padStart(15) + '   ' + origem,
  );
}
console.log(''.padEnd(6) + String(orig.length).padStart(5) + String(luarys.length).padStart(8) + ''.padEnd(14) + totO.toFixed(2).padStart(12) + totL.toFixed(2).padStart(15));

// duplicata real: mesma data+cliente+serviço mais de uma vez no Luarys
const cont = new Map();
for (const l of luarys) {
  const k = `${l.data}|${norm(nomeCli[l.cliente_id])}|${norm(nomeServ[l.servico_id])}|${(+l.valor_final || 0).toFixed(2)}`;
  if (!cont.has(k)) cont.set(k, []);
  cont.get(k).push(l);
}
const dups = [...cont.entries()].filter(([, v]) => v.length > 1);
console.log(`\nduplicatas exatas (data+cliente+serviço+valor): ${dups.length}`);
for (const [k, v] of dups) {
  const marcados = v.filter((x) => String(x.observacao || '').includes(MARCA)).length;
  console.log(`   ${k}  ×${v.length}  (${marcados} importados)`);
}

// linhas do relatório sem par
const chave = new Map();
for (const l of luarys) {
  const k = `${l.data}|${norm(nomeCli[l.cliente_id])}|${norm(nomeServ[l.servico_id])}`;
  chave.set(k, (chave.get(k) || 0) + 1);
}
const faltam = orig.filter((o) => {
  const k = `${o.data}|${norm(o.cliente)}|${norm(o.servico)}`;
  if ((chave.get(k) || 0) > 0) { chave.set(k, chave.get(k) - 1); return false; }
  return true;
});
console.log(`\nlinhas do relatório sem par no Luarys: ${faltam.length}`);
for (const f of faltam) console.log(`   ${f.data}  ${f.prof.split(' ')[0].padEnd(9)}${f.cliente.padEnd(28)}${f.servico.padEnd(34)}${f.valor.toFixed(2)}`);

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const RAIZ = 'C:/Projetos/Luarys';
const env = {};
for (const l of fs.readFileSync(path.join(RAIZ, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const norm = (v) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const brl = (n) => 'R$ ' + n.toFixed(2).replace('.', ',').padStart(10);

const { data: sal } = await s.from('saloes').select('id').eq('nome_fantasia', 'Concept Prime Hair').maybeSingle();

// --- relatórios de origem ---
const dir = path.join(RAIZ, 'scripts/conferencia/dados');
const origem = new Map(); // mes -> linhas
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
  const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  if (!origem.has(j.periodo)) origem.set(j.periodo, []);
  for (const [data, prof, cliente, servico, valor] of j.atendimentos) {
    origem.get(j.periodo).push({ data, prof, cliente, servico, valor: +valor });
  }
}

// --- o que existe no Luarys ---
const { data: profs } = await s.from('profissionais').select('id,nome');
const nomeProf = Object.fromEntries((profs || []).map((p) => [p.id, String(p.nome).trim()]));
const { data: servs } = await s.from('servicos').select('id,nome_servico').eq('salao_id', sal.id);
const nomeServ = Object.fromEntries((servs || []).map((x) => [x.id, x.nome_servico]));
const { data: clis } = await s.from('clientes').select('id,nome_completo').eq('salao_id', sal.id);
const nomeCli = Object.fromEntries((clis || []).map((x) => [x.id, x.nome_completo]));

const meses = [...origem.keys()].sort();
const linhas = [];
for (const mes of meses) {
  const ini = `${mes}-01`;
  const [y, m] = mes.split('-').map(Number);
  const fim = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); // último dia real
  let de = 0;
  for (;;) {
    const { data, error } = await s
      .from('agendamentos')
      .select('id,data,valor_final,profissional_id,servico_id,cliente_id,observacao')
      .eq('salao_id', sal.id).gte('data', ini).lte('data', fim)
      .order('data').range(de, de + 999);
    if (error) throw error;
    linhas.push(...(data || []).map((r) => ({ ...r, mes })));
    if (!data || data.length < 1000) break;
    de += 1000;
  }
}

// --- comparação ---
console.log('\n================ CONFERÊNCIA POR MÊS ================\n');
const pendentes = [];
for (const mes of meses) {
  const orig = origem.get(mes);
  const luarys = linhas.filter((l) => l.mes === mes);

  const porProfO = {}, porProfL = {};
  for (const o of orig) porProfO[o.prof] = (porProfO[o.prof] || 0) + o.valor;
  for (const l of luarys) {
    const p = nomeProf[l.profissional_id] || '?';
    porProfL[p] = (porProfL[p] || 0) + (+l.valor_final || 0);
  }

  console.log(`── ${mes} ──  relatório: ${orig.length} linhas · Luarys: ${luarys.length} registros`);
  for (const p of new Set([...Object.keys(porProfO), ...Object.keys(porProfL)])) {
    const o = porProfO[p] || 0, lv = porProfL[p] || 0;
    const marca = Math.abs(o - lv) < 0.02 ? 'ok ' : '>> ';
    console.log(`   ${marca}${p.padEnd(24)} relatório ${brl(o)}   Luarys ${brl(lv)}   dif ${brl(lv - o)}`);
  }

  // Quais linhas do relatório não têm par no Luarys.
  //
  // Duas passadas, nessa ordem. A primeira casa por data+cliente+serviço. A
  // segunda pega o resto por data+cliente+VALOR: os dois sistemas nomeiam
  // serviços diferente ("Mechas Babylights" x "Mechas Criativas praianas") e o
  // valor cobrado é o que de fato coincide. Sem a segunda passada o conferidor
  // acusava 16 faltas em junho/2026 que já estavam lançadas.
  const livres = luarys.map((l) => ({
    k1: `${l.data}|${norm(nomeCli[l.cliente_id])}|${norm(nomeServ[l.servico_id])}`,
    k2: `${l.data}|${norm(nomeCli[l.cliente_id])}|${(+l.valor_final || 0).toFixed(2)}`,
    usado: false,
  }));
  const pega = (campo, chave) => {
    const r = livres.find((x) => !x.usado && x[campo] === chave);
    if (r) r.usado = true;
    return !!r;
  };
  const restos = [];
  for (const o of orig) {
    if (!pega('k1', `${o.data}|${norm(o.cliente)}|${norm(o.servico)}`)) restos.push(o);
  }
  const faltando = [];
  for (const o of restos) {
    if (!pega('k2', `${o.data}|${norm(o.cliente)}|${o.valor.toFixed(2)}`)) faltando.push(o);
  }
  const porValor = restos.length - faltando.length;
  if (porValor) console.log(`   ${porValor} linhas casaram por valor (nome do serviço diverge entre os sistemas)`);
  if (faltando.length) {
    const dias = [...new Set(faltando.map((f) => f.data))].sort();
    const soma = faltando.reduce((a, f) => a + f.valor, 0);
    console.log(`   FALTAM ${faltando.length} linhas · ${brl(soma)} · dias: ${dias.map((d) => d.slice(8)).join(', ')}`);
    pendentes.push({ mes, faltando });
  }
  console.log();
}

// --- notas fiscais pendentes ---
const { count: pend } = await s.from('notas_fiscais').select('id', { count: 'exact', head: true })
  .eq('salao_id', sal.id).in('status', ['Não Emitido', 'Erro']);
const { count: emit } = await s.from('notas_fiscais').select('id', { count: 'exact', head: true })
  .eq('salao_id', sal.id).eq('status', 'Emitida');
console.log('================ NOTAS FISCAIS ================');
console.log(`   emitidas: ${emit}   ·   não emitidas/erro: ${pend}\n`);

fs.writeFileSync(process.env.SCRATCH + '/pendentes.json', JSON.stringify(pendentes, null, 1));

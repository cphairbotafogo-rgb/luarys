/**
 * Marca como 'Histórico' as notas de competência anterior à ativação fiscal —
 * as que o salão já declarou em outro sistema e que nunca devem ser transmitidas.
 *
 * Por que existe: no dia em que a produção é ligada, a Gaveta de NFS-e ainda
 * mostra as notas antigas em "Não Emitido", com o botão Transmitir ativo. Um
 * "selecionar tudo" as envia de verdade, sobre competências já declaradas —
 * declaração em duplicidade, cada uma precisando de cancelamento no prazo.
 *
 * Só toca em nota que ainda não virou documento: 'Não Emitido' e 'Erro'.
 * Nota 'Emitida' fica como está — no piloto ela guarda a evidência de qual
 * combinação de código o município aceitou, que é dado que queremos manter.
 *
 * Rodar SEMPRE de novo pouco antes de virar a chave: notas criadas entre a
 * primeira execução e a ativação entram na fila do mesmo jeito.
 *
 * Uso: node scripts/conferencia/marcar-historico.mjs "<salão>" <corte> [--aplicar]
 *   node scripts/conferencia/marcar-historico.mjs "Concept Prime Hair" 2026-08-05
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const [SALAO, CORTE] = args;
const APLICAR = process.argv.includes('--aplicar');
if (!SALAO || !CORTE) {
  console.error('uso: marcar-historico.mjs "<salão>" <AAAA-MM-DD> [--aplicar]');
  process.exit(1);
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(CORTE)) { console.error('corte deve ser AAAA-MM-DD'); process.exit(1); }

const env = {};
for (const l of fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: sal } = await db.from('saloes').select('id').eq('nome_fantasia', SALAO).maybeSingle();
if (!sal) { console.error(`salão "${SALAO}" não encontrado`); process.exit(1); }

const notas = [];
for (let de = 0; ; de += 1000) {
  const { data, error } = await db.from('notas_fiscais')
    .select('id, status, valor, cliente_nome, data_movimentacao, data_criacao')
    .eq('salao_id', sal.id).in('status', ['Não Emitido', 'Erro']).range(de, de + 999);
  if (error) { console.error(error.message); process.exit(1); }
  notas.push(...(data || []));
  if (!data || data.length < 1000) break;
}

// Sem competência não dá para comparar por data do serviço — cai para a data de
// criação da nota. São 76 casos no piloto, restos da fase de construção.
const antesDoCorte = (n) => String(n.data_movimentacao ?? n.data_criacao ?? '').slice(0, 10) < CORTE;
const alvo = notas.filter(antesDoCorte);
const ficam = notas.filter((n) => !antesDoCorte(n));

const porMes = {};
for (const n of alvo) {
  const k = n.data_movimentacao ? String(n.data_movimentacao).slice(0, 7) : 'sem competência';
  porMes[k] = porMes[k] || { n: 0, v: 0 };
  porMes[k].n++;
  porMes[k].v += +n.valor || 0;
}

console.log(`\nsalão: ${SALAO}   corte: ${CORTE}`);
console.log(`na fila hoje: ${notas.length} notas`);
console.log(`\na marcar como Histórico: ${alvo.length} · R$ ${alvo.reduce((a, n) => a + (+n.valor || 0), 0).toFixed(2)}`);
for (const [k, t] of Object.entries(porMes).sort()) {
  console.log(`   ${k.padEnd(16)} ${String(t.n).padStart(3)} notas   R$ ${t.v.toFixed(2).padStart(9)}`);
}
console.log(`\npermanecem na fila: ${ficam.length}`);

if (!APLICAR) { console.log('\n(simulação — rode com --aplicar para gravar)'); process.exit(0); }
if (!alvo.length) { console.log('nada a marcar.'); process.exit(0); }

const lotes = Array.from({ length: Math.ceil(alvo.length / 100) }, (_, i) => alvo.slice(i * 100, i * 100 + 100));
for (const lote of lotes) {
  const { error } = await db.from('notas_fiscais')
    .update({ status: 'Histórico' })
    .in('id', lote.map((n) => n.id));
  if (error) { console.error('ERRO:', error.message); process.exit(1); }
}
console.log(`\n${alvo.length} notas marcadas como Histórico.`);

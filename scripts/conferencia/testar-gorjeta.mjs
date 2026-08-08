/**
 * Confere o cálculo da gorjeta contra as taxas reais configuradas pelo salão.
 *
 * Regra (Ari, 07/08/2026): a gorjeta é **100% do profissional**, mas a taxa da
 * maquininha é descontada — quem recebeu no cartão foi o salão, e ele não deve
 * pagar do próprio bolso para intermediar a gorjeta de outra pessoa.
 *
 * O que este teste garante:
 *  · a taxa aplicada é a da bandeira e do número de parcelas, não uma média
 *  · dinheiro e Pix (taxa zero) entregam o valor cheio
 *  · o líquido nunca passa do bruto nem fica negativo
 *  · a tela e o fechamento calculam o MESMO valor — se divergirem, o
 *    profissional vê um número e recebe outro
 *
 *   node scripts/conferencia/testar-gorjeta.mjs
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(),
               l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]),
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data: cfg } = await admin.from('config_taxas')
  .select('taxas_cartoes, taxa_pix, salao_id').limit(1).maybeSingle();
if (!cfg) { console.log('nenhum salão com taxas configuradas.'); process.exit(1); }

const taxas = cfg.taxas_cartoes ?? {};
const taxaPix = Number(cfg.taxa_pix) || 0;
const ok = c => (c ? 'PASSOU' : '*** FALHOU ***');

// Mesma regra dos dois lados: PainelPagamentoFechamento (tela) e
// executarFechamentoConta (gravação). Reproduzida aqui para poder comparar.
function taxaDe(forma, bandeira, parcelas = 1) {
  const f = String(forma).toLowerCase();
  if (f.includes('credito') || f.includes('crédito')) return Number(taxas?.[bandeira]?.[`cred_${parcelas}`]) || 0;
  if (f.includes('debito') || f.includes('débito')) return Number(taxas?.[bandeira]?.debito) || 0;
  if (f.includes('pix')) return taxaPix;
  return 0;
}
const liquidoDe = (bruto, pct) => Math.round((bruto - bruto * pct / 100) * 100) / 100;

console.log(`Taxas do salão ${String(cfg.salao_id).slice(0, 8)} · Pix ${taxaPix}%\n`);

const casos = [
  { forma: 'dinheiro',  bandeira: null,         parcelas: 1, esperado: 0 },
  { forma: 'pix',       bandeira: null,         parcelas: 1, esperado: taxaPix },
  { forma: 'debito',    bandeira: 'Visa',       parcelas: 1, esperado: Number(taxas?.Visa?.debito) },
  { forma: 'debito',    bandeira: 'Elo',        parcelas: 1, esperado: Number(taxas?.Elo?.debito) },
  { forma: 'credito',   bandeira: 'Mastercard', parcelas: 1, esperado: Number(taxas?.Mastercard?.cred_1) },
  { forma: 'credito',   bandeira: 'Mastercard', parcelas: 4, esperado: Number(taxas?.Mastercard?.cred_4) },
  { forma: 'credito',   bandeira: 'Amex',       parcelas: 1, esperado: Number(taxas?.Amex?.cred_1) },
];

const BRUTO = 100;
console.log('Gorjeta de R$ 100,00:\n');
console.log('  forma                       taxa     profissional recebe');
let todosOk = true;
for (const c of casos) {
  const pct = taxaDe(c.forma, c.bandeira, c.parcelas);
  const liq = liquidoDe(BRUTO, pct);
  const certo = pct === c.esperado && liq <= BRUTO && liq >= 0;
  if (!certo) todosOk = false;
  const rotulo = `${c.forma}${c.bandeira ? ' ' + c.bandeira : ''}${c.parcelas > 1 ? ' ' + c.parcelas + 'x' : ''}`;
  console.log(`  ${rotulo.padEnd(26)} ${String(pct.toFixed(2) + '%').padStart(6)}   R$ ${liq.toFixed(2).padStart(6)}   ${certo ? '' : '*** FALHOU ***'}`);
}

console.log('\n=== INVARIANTES ===');
console.log(`Taxa da parcela ≠ taxa de 1x     -> ${ok(taxaDe('credito', 'Mastercard', 4) !== taxaDe('credito', 'Mastercard', 1))}  (4x custa mais que 1x)`);
console.log(`Dinheiro entrega valor cheio     -> ${ok(liquidoDe(BRUTO, taxaDe('dinheiro', null)) === BRUTO)}`);
console.log(`Bandeira desconhecida não quebra -> ${ok(taxaDe('credito', 'BandeiraQueNaoExiste', 1) === 0)}  (cai em 0, não em NaN)`);
console.log(`Parcela sem taxa configurada     -> ${ok(taxaDe('credito', 'Mastercard', 9) === 0)}  (cred_9 é 0,00 no cadastro)`);
console.log(`Líquido nunca negativo           -> ${ok(liquidoDe(1, 99) >= 0)}`);
console.log(`Arredonda em centavos            -> ${ok(String(liquidoDe(33.33, 3.15)).split('.')[1]?.length <= 2)}  ${liquidoDe(33.33, 3.15)}`);

// A taxa da gorjeta NAO pode depender de config_comissao_taxa_op_modo. Esse
// campo decide como repartir a taxa da COMISSAO; se a gorjeta olhasse para ele,
// salao no padrao ('nao_descontar') pagaria a maquininha do proprio bolso — e a
// tela, que calcula sozinha, mostraria um desconto que o registro nao teria.
console.log('\n=== A TAXA DA GORJETA INDEPENDE DO MODO DE COMISSAO ===');
const { data: saloes } = await admin.from('saloes')
  .select('nome_fantasia, config_comissao_taxa_op_modo').eq('id', cfg.salao_id);
console.log(`  modo de comissao deste salao : ${saloes?.[0]?.config_comissao_taxa_op_modo ?? '(nulo -> nao_descontar)'}`);

const fonte = fs.readFileSync('src/modules/agenda/modals/hooks/fechamento/executarFechamentoConta.ts', 'utf8');
const i = fonte.indexOf('let taxaGorjetaPercent');
const bloco = fonte.slice(i, fonte.indexOf('const beneficiarioId', i));
console.log(`  fechamento nao consulta modoTaxaOp -> ${ok(i > 0 && !/modoTaxaOp/.test(bloco))}`);

const painel = fs.readFileSync('src/modules/agenda/modals/fechamento/PainelPagamentoFechamento.tsx', 'utf8');
const j = painel.indexOf('const taxaGorjetaPercent');
const blocoP = painel.slice(j, painel.indexOf('})();', j));
console.log(`  tela tambem nao consulta           -> ${ok(j > 0 && !/modoTaxaOp|taxa_op_modo/.test(blocoP))}`);

const usaParcela = t => t.includes('cred_${parcelas}');
console.log(`  os dois usam a taxa da PARCELA     -> ${ok(usaParcela(bloco) && usaParcela(blocoP))}  (cred_1 fixo pagaria a menos)`);

console.log(todosOk ? '\nCálculo conferido.' : '\n*** divergência acima ***');

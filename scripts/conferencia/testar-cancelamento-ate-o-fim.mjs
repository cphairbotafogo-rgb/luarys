/**
 * Prova que o cancelamento não corta na hora: o módulo/plano tem que continuar
 * funcionando até o fim do período já pago, e só então cair.
 *
 * Monta cenários direto no banco (salão de teste descartável) e roda a régua
 * real — a rota processar-vencimentos — conferindo o que ela faz em cada um.
 *
 *   CRON_SECRET=<segredo> node scripts/conferencia/testar-cancelamento-ate-o-fim.mjs
 *
 * Precisa do servidor de desenvolvimento na 3111 rodando com a MESMA
 * CRON_SECRET. Confere os dois jeitos de autorizar a régua: o "Authorization:
 * Bearer" que o Vercel injeta no cron agendado, e o "x-cron-secret" do disparo
 * manual pelo painel admin.
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

const ok = c => (c ? 'PASSOU' : '*** FALHOU ***');
const SEGREDO = process.env.CRON_SECRET || env.CRON_SECRET;
if (!SEGREDO) { console.log('defina CRON_SECRET para rodar este teste.'); process.exit(1); }
const REGUA = 'http://localhost:3111/api/assinatura/processar-vencimentos';
const rodarRegua = (headers) => fetch(REGUA, { method: 'POST', headers });
const dias = n => new Date(Date.now() + n * 86_400_000).toISOString();

// Salão descartável, para não encostar em salão real.
const { data: salao, error: eS } = await admin.from('saloes').insert({
  razao_social: 'TESTE CANCELAMENTO LTDA',
  nome_fantasia: 'Teste Cancelamento',
  email_contato: `teste-cancel-${Date.now()}@luarys-teste.invalid`,
  plano_chave: 'essencial',
  status_assinatura: 'ativo',
  plano_renovacao_em: dias(20),
}).select('id').single();
if (eS) { console.log('não criou salão de teste:', eS.message); process.exit(1); }
const SALAO = salao.id;
console.log('salão de teste:', SALAO.slice(0, 8), '\n');

const { data: cat } = await admin.from('modulos_catalogo').select('chave').gt('preco_mensal', 0).limit(2);
const [MOD_A, MOD_B] = cat.map(c => c.chave);

async function cenario(modulo, cancelado, vencimento) {
  await admin.from('salao_modulos').delete().eq('salao_id', SALAO).eq('modulo_chave', modulo);
  await admin.from('salao_modulos').insert({
    salao_id: SALAO, modulo_chave: modulo, ativo: true,
    cancelamento_agendado: cancelado, renovacao_em: vencimento, periodo: 'mensal',
  });
}
async function ler(modulo) {
  const { data } = await admin.from('salao_modulos')
    .select('ativo, cancelamento_agendado').eq('salao_id', SALAO).eq('modulo_chave', modulo).maybeSingle();
  return data;
}

// A: cancelado, ainda DENTRO do período pago (vence em 12 dias)
await cenario(MOD_A, true, dias(12));
// B: cancelado, período pago JÁ VENCIDO (venceu ontem)
await cenario(MOD_B, true, dias(-1));

console.log('=== ANTES DE RODAR A RÉGUA ===');
console.log(`Cancelado, vence em 12 dias  -> ativo=${(await ler(MOD_A)).ativo}`);
console.log(`Cancelado, venceu ontem      -> ativo=${(await ler(MOD_B)).ativo}`);

console.log('\n=== COMO A RÉGUA É AUTORIZADA ===');
const semNada = await rodarRegua({});
console.log(`Sem segredo                  -> ${semNada.status} ${ok(semNada.status === 401)}`);
const errado = await rodarRegua({ Authorization: 'Bearer segredo-errado' });
console.log(`Segredo errado               -> ${errado.status} ${ok(errado.status === 401)}`);
const manual = await rodarRegua({ 'x-cron-secret': SEGREDO });
console.log(`x-cron-secret (admin manual) -> ${manual.status} ${ok(manual.status === 200)}`);
const r = await rodarRegua({ Authorization: `Bearer ${SEGREDO}` });
console.log(`Bearer (cron do Vercel)      -> ${r.status} ${ok(r.status === 200)}`);
const res = await r.json().catch(() => ({}));
console.log(`resultado -> ${JSON.stringify(res).slice(0, 200)}`);

const a = await ler(MOD_A), b = await ler(MOD_B);
console.log('\n=== DEPOIS ===');
console.log(`Cancelado dentro do período  -> ativo=${a.ativo}  ${ok(a.ativo === true)}  (tem que continuar funcionando)`);
console.log(`Cancelado e período vencido  -> ativo=${b.ativo}  ${ok(b.ativo === false)}  (aí sim desliga)`);

// Mesmo teste para o PLANO, que segue outro caminho no código.
console.log('\n=== PLANO ===');
await admin.from('saloes').update({ cancelamento_agendado: true, plano_renovacao_em: dias(12), status_assinatura: 'ativo' }).eq('id', SALAO);
await rodarRegua({ Authorization: `Bearer ${SEGREDO}` });
let p = (await admin.from('saloes').select('status_assinatura').eq('id', SALAO).maybeSingle()).data;
console.log(`Cancelado, vence em 12 dias  -> status=${p.status_assinatura}  ${ok(p.status_assinatura === 'ativo')}`);

await admin.from('saloes').update({ plano_renovacao_em: dias(-1) }).eq('id', SALAO);
await rodarRegua({ Authorization: `Bearer ${SEGREDO}` });
p = (await admin.from('saloes').select('status_assinatura').eq('id', SALAO).maybeSingle()).data;
console.log(`Cancelado, período vencido   -> status=${p.status_assinatura}  ${ok(p.status_assinatura === 'suspenso')}`);

// A protecao que impede acusar de atraso quem pagou: aponta um modulo vencido
// para uma assinatura REAL do sandbox que tem cobranca confirmada. Se a regua
// conseguir confirmar no Asaas, ela nao marca aviso de atraso.
console.log('\n=== NAO ACUSAR ATRASO DE QUEM PAGOU ===');
const { data: conta } = await admin.from('plataforma_contas_recebimento')
  .select('asaas_api_key, asaas_environment').eq('ativa', true).maybeSingle();
const baseAsaas = conta.asaas_environment === 'sandbox'
  ? 'https://sandbox.asaas.com/api/v3' : 'https://api.asaas.com/v3';
const { data: comSub } = await admin.from('salao_modulos')
  .select('asaas_subscription_id').not('asaas_subscription_id', 'is', null).limit(1).maybeSingle();
const SUB = comSub?.asaas_subscription_id;
const pg = SUB
  ? await (await fetch(`${baseAsaas}/payments?subscription=${SUB}`, { headers: { access_token: conta.asaas_api_key } })).json()
  : {};
const temPago = (pg?.data ?? []).some(x => ['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'].includes(String(x.status)));
console.log(`Assinatura de referência     -> ${SUB ?? '(nenhuma)'} · cobrança confirmada: ${temPago}`);

if (SUB && temPago) {
  const MOD = 'garantia_reserva';
  await admin.from('salao_modulos').delete().eq('salao_id', SALAO).eq('modulo_chave', MOD);
  await admin.from('salao_modulos').insert({
    salao_id: SALAO, modulo_chave: MOD, ativo: true, cancelamento_agendado: false,
    renovacao_em: dias(-1), periodo: 'mensal', asaas_subscription_id: SUB,
  });
  await rodarRegua({ Authorization: `Bearer ${SEGREDO}` });
  const { data: dep } = await admin.from('salao_modulos')
    .select('aviso_enviado_em, ativo').eq('salao_id', SALAO).eq('modulo_chave', MOD).maybeSingle();
  console.log(`Pagou, mas venceu ontem      -> aviso=${dep?.aviso_enviado_em ?? 'nenhum'}  ${ok(!dep?.aviso_enviado_em)}  (não pode acusar atraso)`);
} else {
  console.log('  (sem assinatura paga no sandbox para comparar — cenário não exercitado)');
}

console.log('\n=== LIMPEZA ===');
await admin.from('salao_modulos').delete().eq('salao_id', SALAO);
await admin.from('saloes').delete().eq('id', SALAO);
console.log('  salão de teste apagado.');

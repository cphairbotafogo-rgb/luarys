/**
 * Teste de ponta a ponta da contratação com cartão já salvo.
 *
 * Exercita a rota real (servidor de desenvolvimento na 3111) com sessões de
 * verdade, cobra no Asaas e confere o resultado nos dois lados — banco e
 * gateway. Cria tudo descartável e limpa no fim, inclusive estornando as
 * cobranças, para não deixar lixo na conta.
 *
 * SÓ RODA EM SANDBOX. Aborta se a conta ativa for de produção — este teste
 * cobra cartão de verdade, e em produção isso seria dinheiro real do salão.
 *
 *   node scripts/conferencia/testar-compra-cartao-salvo.mjs
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
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });

const { data: conta } = await admin.from('plataforma_contas_recebimento')
  .select('asaas_api_key, asaas_environment').eq('ativa', true).maybeSingle();

if (conta?.asaas_environment !== 'sandbox') {
  console.log(`ABORTADO: a conta Asaas ativa é "${conta?.asaas_environment ?? 'produção (padrão)'}".`);
  console.log('Este teste cobra cartão de verdade — só rode com a conta em sandbox.');
  process.exit(1);
}

const chave = conta.asaas_api_key;
const base = 'https://sandbox.asaas.com/api/v3';
const URL = 'http://localhost:3111/api/assinatura/contratar-com-cartao-salvo';
const SENHA = 'SenhaCerta#2026';

console.log('AMBIENTE ASAAS: sandbox\n');

// Salão que já tem cartão salvo — é o pré-requisito do fluxo.
const { data: comCartao } = await admin.from('salao_modulos')
  .select('salao_id').not('asaas_subscription_id', 'is', null).limit(1).maybeSingle();
const SALAO = comCartao.salao_id;

const { data: temMods } = await admin.from('salao_modulos').select('modulo_chave').eq('salao_id', SALAO);
const jaTem = new Set((temMods ?? []).map(m => m.modulo_chave));
const { data: cat } = await admin.from('modulos_catalogo').select('chave, nome, preco_mensal');
const alvo = (cat ?? []).find(c => !jaTem.has(c.chave) && Number(c.preco_mensal) > 0);
if (!alvo) { console.log('Nenhum módulo livre para testar neste salão.'); process.exit(1); }
console.log(`Módulo usado no teste: ${alvo.nome} — R$ ${alvo.preco_mensal}\n`);

// Dono descartável.
const emailDono = `teste-compra-${Date.now()}@luarys-teste.invalid`;
const { data: novo } = await admin.auth.admin.createUser({ email: emailDono, password: SENHA, email_confirm: true });
await admin.from('perfis_usuarios').insert({ id: novo.user.id, salao_id: SALAO, regra: 'dono', nivel_acesso: 'admin', nome: 'Teste Compra' });
const { data: sess } = await anon.auth.signInWithPassword({ email: emailDono, password: SENHA });
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${sess.session.access_token}` };

// Recepção descartável — quem NÃO pode comprar, mesmo com a senha certa.
const emailRecep = `teste-recepcao-${Date.now()}@luarys-teste.invalid`;
const { data: recep } = await admin.auth.admin.createUser({ email: emailRecep, password: SENHA, email_confirm: true });
await admin.from('perfis_usuarios').insert({ id: recep.user.id, salao_id: SALAO, regra: 'recepcao', nivel_acesso: 'recepcao', nome: 'Teste Recepcao' });
const { data: sessR } = await anon.auth.signInWithPassword({ email: emailRecep, password: SENHA });
const HR = { 'Content-Type': 'application/json', Authorization: `Bearer ${sessR.session.access_token}` };

const ok = c => (c ? 'PASSOU' : '*** FALHOU ***');
async function post(headers, corpo) {
  const r = await fetch(URL, { method: 'POST', headers, body: JSON.stringify(corpo) });
  return { status: r.status, corpo: await r.json().catch(() => ({})) };
}
const M = alvo.chave;
let x;

console.log('=== BLOQUEIOS ===');
x = await post({ 'Content-Type': 'application/json' }, { modulo_chave: M, confirmo: true, senha: SENHA });
console.log(`Sem login                      -> ${x.status} ${ok(x.status === 401)}  ${x.corpo.erro ?? ''}`);
x = await post(H, {});
console.log(`Sem informar o módulo          -> ${x.status} ${ok(x.status === 400)}  ${x.corpo.erro ?? ''}`);
x = await post(H, { modulo_chave: M });
console.log(`Sem marcar a confirmação       -> ${x.status} ${ok(x.status === 428)}  ${x.corpo.erro ?? ''}`);
x = await post(H, { modulo_chave: M, confirmo: true });
console.log(`Sem digitar a senha            -> ${x.status} ${ok(x.status === 401)}  ${x.corpo.erro ?? ''}`);
x = await post(H, { modulo_chave: M, confirmo: true, senha: 'senha-errada' });
console.log(`Senha errada                   -> ${x.status} ${ok(x.status === 401)}  ${x.corpo.erro ?? ''}`);
x = await post(HR, { modulo_chave: M, confirmo: true, senha: SENHA });
console.log(`Recepção com a senha certa     -> ${x.status} ${ok(x.status === 403)}  ${x.corpo.erro ?? ''}`);

console.log('\n=== COMPRA VÁLIDA (dono, senha certa) ===');
x = await post(H, { modulo_chave: M, periodo: 'mensal', confirmo: true, senha: SENHA });
console.log(`Resposta                       -> ${x.status} ${ok(x.status === 200)}  ${JSON.stringify(x.corpo)}`);

const { data: linha } = await admin.from('salao_modulos')
  .select('asaas_subscription_id, ativo, renovacao_em').eq('salao_id', SALAO).eq('modulo_chave', M).maybeSingle();
console.log(`Módulo ativado no banco        -> ${ok(linha?.ativo === true)}  ativo=${linha?.ativo} vence=${linha?.renovacao_em}`);

const subId = linha?.asaas_subscription_id;
let pagos = [];
if (subId) {
  const pg = await (await fetch(`${base}/payments?subscription=${subId}`, { headers: { access_token: chave } })).json();
  pagos = pg?.data ?? [];
  console.log(`Cobranças geradas              -> ${ok(pagos.length === 1)}  ${pagos.length} cobrança(s)`);
  console.log(`Status / valor / cartão        -> ${ok(pagos[0]?.status === 'CONFIRMED')}  ${pagos[0]?.status} R$ ${pagos[0]?.value} cartão ${pagos[0]?.creditCard?.creditCardNumber}`);
  console.log(`Valor bate com o catálogo      -> ${ok(Number(pagos[0]?.value) === Number(alvo.preco_mensal))}`);
}
const { data: pgto } = await admin.from('pagamentos_assinatura')
  .select('status, valor').eq('salao_id', SALAO).eq('modulo_chave', M);
console.log(`Pagamento registrado no Luarys -> ${ok(pgto?.[0]?.status === 'approved')}  ${JSON.stringify(pgto)}`);

console.log('\n=== CLIQUE REPETIDO ===');
x = await post(H, { modulo_chave: M, periodo: 'mensal', confirmo: true, senha: SENHA });
console.log(`Segunda compra do mesmo item   -> ${x.status} ${ok(x.status === 409)}  ${x.corpo.erro ?? ''}`);
if (subId) {
  const pg2 = await (await fetch(`${base}/payments?subscription=${subId}`, { headers: { access_token: chave } })).json();
  console.log(`Continua com 1 cobrança só     -> ${ok((pg2?.data ?? []).length === 1)}  ${(pg2?.data ?? []).length}`);
}

console.log('\n=== LIMPEZA ===');
for (const p of pagos) {
  const r = await fetch(`${base}/payments/${p.id}/refund`, {
    method: 'POST', headers: { access_token: chave, 'Content-Type': 'application/json' },
    body: JSON.stringify({ description: 'estorno de teste' }),
  });
  console.log('  cobrança estornada:', p.id, (await r.json().catch(() => ({})))?.status);
}
if (subId) {
  const d = await fetch(`${base}/subscriptions/${subId}`, { method: 'DELETE', headers: { access_token: chave } });
  console.log('  assinatura cancelada:', d.status);
}
await admin.from('salao_modulos').delete().eq('salao_id', SALAO).eq('modulo_chave', M);
await admin.from('pagamentos_assinatura').delete().eq('salao_id', SALAO).eq('modulo_chave', M);
for (const u of [novo.user.id, recep.user.id]) {
  await admin.from('perfis_usuarios').delete().eq('id', u);
  await admin.auth.admin.deleteUser(u);
}
console.log('  usuários e linhas de teste apagados.');

const hoje = new Date().toISOString().slice(0, 10);
const sobra = await (await fetch(`${base}/payments?dateCreated[ge]=${hoje}&limit=100`, { headers: { access_token: chave } })).json();
const pendentes = (sobra?.data ?? []).filter(p => p.status !== 'REFUNDED');
console.log(`  cobranças de hoje não estornadas -> ${pendentes.length === 0 ? 'nenhuma' : pendentes.map(p => p.id + ':' + p.status).join(', ')}`);

/**
 * Prova QUANDO a régua encerra o cadastro do CNPJ na Brasil NFe.
 *
 * A chamada real de exclusão não é exercida aqui de propósito: deletar a empresa
 * do piloto na Brasil NFe é irreversível pelo nosso lado (reativar exige o salão
 * subir o certificado A1 de novo, que não guardamos). O que se testa é a decisão
 * — o salão de teste não tem `brasilnfe_company_token`, então `excluirEmpresaLuarys`
 * devolve `jaEstavaFora` sem tocar no provedor, e o que se observa é se a régua
 * chegou ou não a esse ponto.
 *
 * Os quatro casos que importam:
 *   1. NFC-e cancelada, NFS-e ainda ativa  -> NAO pode encerrar (mataria a NFS-e)
 *   2. Os dois cancelados e vencidos       -> encerra
 *   3. Cancelado mas dentro do periodo     -> NAO encerra ainda
 *   4. Modulo que nao e fiscal             -> nem consulta
 *
 *   CRON_SECRET=<segredo> node scripts/conferencia/testar-encerramento-fiscal.mjs
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

const SEGREDO = process.env.CRON_SECRET || env.CRON_SECRET;
if (!SEGREDO) { console.log('defina CRON_SECRET para rodar este teste.'); process.exit(1); }

const ok = c => (c ? 'PASSOU' : '*** FALHOU ***');
const dias = n => new Date(Date.now() + n * 86_400_000).toISOString();
const REGUA = 'http://localhost:3111/api/assinatura/processar-vencimentos';
const rodar = () => fetch(REGUA, { method: 'POST', headers: { Authorization: `Bearer ${SEGREDO}` } });

const { data: salao, error } = await admin.from('saloes').insert({
  razao_social: 'TESTE ENCERRAMENTO FISCAL LTDA',
  nome_fantasia: 'Teste Encerramento',
  email_contato: `teste-fiscal-${Date.now()}@luarys-teste.invalid`,
  plano_chave: 'essencial', status_assinatura: 'ativo', plano_renovacao_em: dias(30),
  // Sem brasilnfe_company_token: a exclusão devolve `jaEstavaFora` e não chama
  // o provedor. É o que torna este teste seguro de rodar.
  config_fiscal: { regime_tributario: 'Simples Nacional' },
}).select('id').single();
if (error) { console.log('não criou salão de teste:', error.message); process.exit(1); }
const SALAO = salao.id;
console.log('salão de teste:', SALAO.slice(0, 8), '(sem cadastro na Brasil NFe)\n');

async function montar(cenarios) {
  await admin.from('salao_modulos').delete().eq('salao_id', SALAO);
  await admin.from('salao_modulos').insert(cenarios.map(c => ({
    salao_id: SALAO, modulo_chave: c.chave, ativo: true,
    cancelamento_agendado: c.cancelado, renovacao_em: c.vence, periodo: 'mensal',
  })));
}
async function estado() {
  const { data } = await admin.from('salao_modulos')
    .select('modulo_chave, ativo').eq('salao_id', SALAO).order('modulo_chave');
  return (data ?? []).map(m => `${m.modulo_chave}=${m.ativo ? 'ativo' : 'off'}`).join(' ');
}

console.log('=== CASO 1: NFC-e cancelada e vencida, NFS-e ainda ativa ===');
await montar([
  { chave: 'nfce', cancelado: true,  vence: dias(-1) },
  { chave: 'nfse', cancelado: false, vence: dias(20) },
]);
let r = await (await rodar()).json();
console.log('  depois:', await estado());
console.log(`  NAO encerrou o cadastro       -> ${ok(!r.resultado?.fiscal?.excluidos)}  (encerrar aqui mataria a NFS-e)`);

console.log('\n=== CASO 2: os dois cancelados e vencidos ===');
await montar([
  { chave: 'nfce', cancelado: true, vence: dias(-1) },
  { chave: 'nfse', cancelado: true, vence: dias(-1) },
]);
r = await (await rodar()).json();
console.log('  depois:', await estado());
const { data: cfDepois } = await admin.from('saloes').select('config_fiscal').eq('id', SALAO).maybeSingle();
console.log(`  Os dois desativados           -> ${ok((await estado()).split(' ').every(x => x.endsWith('off')))}`);
console.log(`  Chegou ao encerramento        -> ${ok(!r.resultado?.fiscal?.falhas)}  (sem token, sai como "já estava fora")`);

console.log('\n=== CASO 3: cancelado, mas ainda dentro do período pago ===');
await montar([
  { chave: 'nfse', cancelado: true, vence: dias(12) },
  { chave: 'nfce', cancelado: true, vence: dias(12) },
]);
r = await (await rodar()).json();
console.log('  depois:', await estado());
console.log(`  Continua ativo                -> ${ok((await estado()).split(' ').every(x => x.endsWith('ativo')))}`);
console.log(`  NAO encerrou o cadastro       -> ${ok(!r.resultado?.fiscal?.excluidos)}`);

console.log('\n=== CASO 4: módulo que não é fiscal ===');
await montar([{ chave: 'central_comunicacao', cancelado: true, vence: dias(-1) }]);
r = await (await rodar()).json();
console.log('  depois:', await estado());
console.log(`  Desativou o módulo            -> ${ok((await estado()).includes('off'))}`);
console.log(`  Nem consultou o fiscal        -> ${ok(!r.resultado?.fiscal)}`);

console.log('\n=== LIMPEZA ===');
await admin.from('salao_modulos').delete().eq('salao_id', SALAO);
await admin.from('saloes').delete().eq('id', SALAO);
console.log('  salão de teste apagado.');

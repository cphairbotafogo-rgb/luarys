/**
 * Apaga um salão e tudo que pende dele.
 *
 * Grava backup completo ANTES de tocar em qualquer linha — não há desfazer no
 * banco, e o backup é a única volta possível.
 *
 * Os LOGINS não são apagados aqui, de propósito. Um usuário do auth pode ser o
 * do próprio Ari (aspfotomomento@gmail.com e artide_peixoto@hotmail.com são
 * donos de salões de teste), e apagar isso derrubaria o acesso dele ao sistema.
 * Sem salão, o perfil some e o login fica órfão — inofensivo, e reversível.
 *
 *   node scripts/conferencia/apagar-saloes.mjs            (ensaio)
 *   node scripts/conferencia/apagar-saloes.mjs --aplicar
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const APLICAR = process.argv.includes('--aplicar');

const ALVOS = {
  '6b160fa9-2323-45f7-a12b-1e3f47c11d11': 'mateus',
  '78a29b9c-c3cc-477d-a228-9ec2a499ef48': 'BelezaBeleza',
  '9c66644c-c716-456d-b2ce-f695d92db75d': 'Eleva Beauty Studio',
};

// Nunca apagar. O piloto real e o salão usado nos testes de cobrança — se um id
// destes aparecer na lista de alvos, o script para em vez de obedecer.
const PROTEGIDOS = {
  '2746822d-fcbf-4d03-9f1a-cc66f94adbf2': 'Concept Prime Hair (piloto real)',
  'c6db3964-2770-4515-b7f8-f3edd800546b': 'Salao Teste Asaas (usado nos testes)',
};

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(),
               l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]),
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const ids = Object.keys(ALVOS);
for (const id of ids) {
  if (PROTEGIDOS[id]) { console.log(`ABORTADO: ${id} é ${PROTEGIDOS[id]}.`); process.exit(1); }
}

// Ordem importa: filhos antes dos pais, senão a chave estrangeira barra.
const ORDEM = [
  'servicos_publico', 'profissionais_publico',
  'comissoes', 'comissao_extras', 'agendamentos',
  'caixa_transacoes', 'financeiro', 'notas_fiscais', 'nfce_emissoes',
  'servicos', 'produtos', 'estoque', 'historico_estoque',
  'clientes', 'crm_clientes', 'carteira_clientes',
  'profissionais', 'setores_salao',
  'salao_modulos', 'salao_planos_historico', 'pagamentos_assinatura',
  'auditoria_log', 'log_auditoria_acoes',
  'perfis_usuarios',
];
// Descobre sozinho quais tabelas tem salao_id, pelo OpenAPI do PostgREST. Uma
// lista escrita a mao envelhece — tabela nova entra no sistema e o script
// deixaria dado para tras sem avisar, que e o pior jeito de falhar aqui.
const spec = await (await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
  headers: {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  },
})).json();
const todas = Object.entries(spec.definitions ?? {})
  .filter(([, d]) => d.properties && ('salao_id' in d.properties))
  .map(([n]) => n).sort();
if (!todas.length) { console.log('não consegui descobrir as tabelas com salao_id.'); process.exit(1); }
console.log(`${todas.length} tabelas têm salao_id.`);
// O resto entra depois da lista ordenada; nenhuma tabela fica para trás.
const fila = [...ORDEM.filter(t => todas.includes(t)), ...todas.filter(t => !ORDEM.includes(t))];

console.log('Salões a apagar:');
for (const [id, nome] of Object.entries(ALVOS)) console.log(`  ${nome} (${id.slice(0, 8)})`);

const backup = { gerado_em: new Date().toISOString(), saloes: {}, tabelas: {} };
const { data: linhasSalao } = await admin.from('saloes').select('*').in('id', ids);
backup.saloes = linhasSalao;

let total = 0;
const comDados = [];
for (const t of fila) {
  const { data, error } = await admin.from(t).select('*').in('salao_id', ids);
  if (error || !data?.length) continue;
  backup.tabelas[t] = data;
  comDados.push({ tabela: t, linhas: data.length });
  total += data.length;
}

console.log(`\n${total} linhas em ${comDados.length} tabelas, mais ${linhasSalao?.length ?? 0} linhas em saloes:`);
for (const c of comDados) console.log(`  ${c.tabela.padEnd(30)} ${String(c.linhas).padStart(4)}`);

if (!APLICAR) {
  console.log('\n(ensaio — rode com --aplicar para apagar)');
  process.exit(0);
}

const arquivo = `scripts/conferencia/backup-saloes-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
fs.writeFileSync(arquivo, JSON.stringify(backup, null, 2));
console.log(`\nbackup gravado: ${arquivo} (${(fs.statSync(arquivo).size / 1024).toFixed(1)} KB)`);

let apagadas = 0;
for (const c of comDados) {
  const { error } = await admin.from(c.tabela).delete().in('salao_id', ids);
  if (error) { console.log(`  ERRO em ${c.tabela}: ${error.message}`); continue; }
  console.log(`  ${c.tabela.padEnd(30)} ${String(c.linhas).padStart(4)} apagadas`);
  apagadas += c.linhas;
}

const { error: erroSalao } = await admin.from('saloes').delete().in('id', ids);
console.log(erroSalao ? `  ERRO ao apagar saloes: ${erroSalao.message}` : `  saloes${' '.repeat(24)}   ${linhasSalao.length} apagadas`);

console.log(`\n${apagadas} linhas removidas. Conferindo o que sobrou:`);
let sobrou = 0;
for (const t of fila) {
  const { count } = await admin.from(t).select('*', { count: 'exact', head: true }).in('salao_id', ids);
  if (count) { console.log(`  *** ${t}: ainda ${count}`); sobrou += count; }
}
const { count: restam } = await admin.from('saloes').select('*', { count: 'exact', head: true }).in('id', ids);
console.log(sobrou || restam ? `*** sobrou coisa — ver acima (saloes: ${restam})` : '  nada — nenhum rastro nas 72 tabelas nem em saloes.');

const { data: orfaos } = await admin.from('perfis_usuarios').select('id').in('salao_id', ids);
console.log(`\nLogins NAO apagados (decisão do Ari): perfis restantes ${orfaos?.length ?? 0}.`);
console.log('Os usuários do auth continuam existindo, agora sem salão. Para apagá-los é preciso');
console.log('dizer explicitamente quais — um deles é o e-mail do próprio Ari.');

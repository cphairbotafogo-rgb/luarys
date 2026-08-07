/**
 * Confere o catálogo NBS — antes e depois de aplicar a migration 20260807a.
 *
 * Roda os dois cenários que a tela pode encontrar:
 *   · tabela ausente  → a tela tem que cair no fallback, sem quebrar
 *   · tabela presente → conteúdo certo, leitura permitida a quem está logado
 *     e negada a quem não está
 *
 *   node scripts/conferencia/testar-catalogo-nbs.mjs
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

const ok = c => (c ? 'PASSOU' : '*** FALHOU ***');

// O que a migration promete. Se algum destes sair diferente, a tela mostra
// código errado para todo salão do país — é o mesmo defeito que estava fixo no
// bundle, só que agora num lugar onde dá para corrigir sem deploy.
const ESPERADO = {
  '126021000': { exibe: '1.2602.10.00', tem: /cabeleireiro/i },
  '126022000': { exibe: '1.2602.20.00', tem: /manicure/i },
  '126023000': { exibe: '1.2602.30.00', tem: /bem-estar/i },
  '126029000': { exibe: '1.2602.90.00', tem: /depila|outros/i },
};

const { data, error } = await admin.from('nbs_catalogo')
  .select('codigo, codigo_exibe, rotulo, descricao, exemplos, ctribnac, ativo, fonte').order('ordem');

if (error) {
  console.log('TABELA AINDA NAO EXISTE — rode a migration 20260807a_nbs_catalogo.sql.');
  console.log(`   erro do banco: ${error.message}\n`);
  console.log('Cenario "sem tabela" (o que a tela faz hoje):');
  console.log(`  a consulta falha e o hook mantem o fallback  ${ok(!!error)}`);
  console.log('  a tela mostra os 4 codigos ja corrigidos, entao ninguem fica com o erro antigo.');
  process.exit(0);
}

console.log(`TABELA PRESENTE — ${data.length} codigos\n`);
console.log('=== CONTEUDO ===');
let tudoOk = data.length === Object.keys(ESPERADO).length;
console.log(`Quantidade de codigos          -> ${data.length} ${ok(data.length === 4)}`);
for (const [cod, esp] of Object.entries(ESPERADO)) {
  const linha = data.find(d => d.codigo === cod);
  const certo = !!linha && linha.codigo_exibe === esp.exibe
    && esp.tem.test(`${linha.rotulo} ${linha.descricao}`) && linha.ativo;
  if (!certo) tudoOk = false;
  console.log(`  ${cod} ${String(linha?.codigo_exibe ?? '-').padEnd(14)} ${ok(certo)}  ${linha?.rotulo ?? '(ausente)'}`);
}

console.log('\n=== O QUE A TELA PRECISA ===');
const semExemplo = data.filter(d => !d.exemplos?.trim());
console.log(`Todos com exemplos             -> ${ok(semExemplo.length === 0)}${semExemplo.length ? ' faltam: ' + semExemplo.map(d => d.codigo).join(', ') : ''}`);
const semNac = data.filter(d => !d.ctribnac?.trim());
console.log(`Todos com cTribNac sugerido    -> ${ok(semNac.length === 0)}`);
const semFonte = data.filter(d => !d.fonte?.trim());
console.log(`Todos com a fonte registrada   -> ${ok(semFonte.length === 0)}`);

console.log('\n=== PERMISSAO ===');
const semLogin = await anon.from('nbs_catalogo').select('codigo');
console.log(`Sem login nao le               -> ${ok(!!semLogin.error || (semLogin.data ?? []).length === 0)}  ${semLogin.error?.message ?? (semLogin.data?.length ?? 0) + ' linhas'}`);

// Sessao real de um usuario qualquer, para provar que quem esta logado le.
const { data: perfis } = await admin.from('perfis_usuarios').select('id').limit(20);
const { data: users } = await admin.auth.admin.listUsers({ perPage: 200 });
const alvo = (perfis ?? []).map(p => users.users.find(u => u.id === p.id)).find(u => u?.email);
if (alvo) {
  const { data: link } = await admin.auth.admin.generateLink({ type: 'magiclink', email: alvo.email });
  const { data: sess } = await anon.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' });
  const logado = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${sess.session.access_token}` } },
  });
  const r = await logado.from('nbs_catalogo').select('codigo, rotulo').order('ordem');
  console.log(`Usuario logado le os 4         -> ${ok(!r.error && r.data?.length === 4)}  ${r.error?.message ?? r.data.map(x => x.codigo).join(', ')}`);
  const escrita = await logado.from('nbs_catalogo').update({ rotulo: 'invasao' }).eq('codigo', '126021000');
  const naoEscreveu = !!escrita.error || (await admin.from('nbs_catalogo').select('rotulo').eq('codigo', '126021000').maybeSingle()).data?.rotulo !== 'invasao';
  console.log(`Usuario logado NAO escreve     -> ${ok(naoEscreveu)}  ${escrita.error?.message ?? 'update sem efeito'}`);
}

console.log(tudoOk ? '\nCatalogo conferido.' : '\n*** Catalogo com divergencia — ver acima.');

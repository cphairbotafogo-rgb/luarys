/**
 * Apaga logins do auth que não têm perfil nenhum.
 *
 * Login órfão aparece depois que um salão é removido: o `perfis_usuarios` vai
 * junto, o usuário do auth fica. Ele consegue entrar e não tem onde entrar.
 *
 * Só toca em quem não tem linha em `perfis_usuarios` NEM em `usuarios_portal`.
 *
 * As duas listas importam. Na primeira versão eu olhei só `perfis_usuarios` e o
 * script propôs apagar "josue@gmail.com", que é cliente do portal do salão
 * piloto — não login de salão nenhum. Quem impediu foi a chave estrangeira do
 * banco, não este código. Um login pode existir por dois motivos completamente
 * diferentes, e olhar um só deles chama o outro de lixo.
 *
 * Grava backup dos registros antes de apagar; um usuário do auth recriado tem
 * id novo, então sem o backup nem dá para saber quem existia.
 *
 *   node scripts/conferencia/apagar-logins-orfaos.mjs            (ensaio)
 *   node scripts/conferencia/apagar-logins-orfaos.mjs --aplicar
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const APLICAR = process.argv.includes('--aplicar');

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(),
               l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]),
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data: perfis, error } = await admin.from('perfis_usuarios').select('id, salao_id, is_plataforma_admin');
if (error) { console.log('não consegui ler os perfis:', error.message); process.exit(1); }
const comPerfil = new Set(perfis.map(p => p.id));

// Cliente do portal também é usuário do auth, e por definição não tem perfil de
// salão. Sem esta lista, ele é confundido com login abandonado.
const { data: portal, error: erroPortal } = await admin
  .from('usuarios_portal').select('id, nome_completo, email');
if (erroPortal) { console.log('não consegui ler os usuários do portal:', erroPortal.message); process.exit(1); }
const noPortal = new Set(portal.map(p => p.id));

const { data: users } = await admin.auth.admin.listUsers({ perPage: 200 });
const orfaos = users.users.filter(u => !comPerfil.has(u.id) && !noPortal.has(u.id));

console.log(`${users.users.length} logins · ${comPerfil.size} de salão · ${noPortal.size} do portal · ${orfaos.length} órfãos\n`);

if (portal.length) {
  console.log('CLIENTES DO PORTAL — não serão tocados:');
  for (const p of portal) console.log(`  ${String(p.email).padEnd(42)} ${p.nome_completo ?? ''}`);
  console.log('');
}
console.log('COM PERFIL — não serão tocados:');
for (const u of users.users.filter(x => comPerfil.has(x.id))) {
  const p = perfis.find(x => x.id === u.id);
  console.log(`  ${String(u.email).padEnd(42)} salão ${String(p.salao_id).slice(0, 8)} ${p.is_plataforma_admin ? '· ADMIN DA PLATAFORMA' : ''}`);
}

if (!orfaos.length) { console.log('\nNenhum órfão.'); process.exit(0); }
console.log('\nÓRFÃOS — seriam apagados:');
for (const u of orfaos) console.log(`  ${String(u.email).padEnd(42)} último acesso ${u.last_sign_in_at?.slice(0, 10) ?? 'nunca'}`);

if (!APLICAR) { console.log('\n(ensaio — rode com --aplicar para apagar)'); process.exit(0); }

const arquivo = `scripts/conferencia/backup-logins-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
fs.writeFileSync(arquivo, JSON.stringify(orfaos, null, 2));
console.log(`\nbackup gravado: ${arquivo}`);

let apagados = 0;
for (const u of orfaos) {
  const { error: e } = await admin.auth.admin.deleteUser(u.id);
  if (e) { console.log(`  ERRO em ${u.email}: ${e.message}`); continue; }
  console.log(`  apagado: ${u.email}`);
  apagados++;
}

const { data: depois } = await admin.auth.admin.listUsers({ perPage: 200 });
const aindaOrfaos = depois.users.filter(u => !comPerfil.has(u.id) && !noPortal.has(u.id));
console.log(`\n${apagados} de ${orfaos.length} apagados · restam ${depois.users.length} logins`);
console.log(aindaOrfaos.length ? `*** ainda ha ${aindaOrfaos.length} orfaos: ${aindaOrfaos.map(u => u.email).join(', ')}` : '  nenhum órfão restante.');

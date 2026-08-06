/**
 * Monta um zip do código-fonte para auditoria externa, sem segredo dentro.
 *
 * O motivo do filtro: `.env.local` guarda a SUPABASE_SERVICE_ROLE_KEY, que
 * ignora RLS e lê o banco inteiro — cliente, financeiro, nota fiscal. Mandar
 * isso num zip de auditoria entrega a plataforma. Mesma coisa para certificado
 * A1 (.pfx/.p12), que assina nota em nome do CNPJ do salão.
 *
 * O filtro é por lista de permissão, não por exclusão: só entra o que está em
 * INCLUIR. Esquecer de excluir algo é fácil; esquecer de incluir só faz faltar
 * um arquivo na auditoria.
 *
 * Uso: node scripts/conferencia/empacotar-codigo.mjs [destino.zip]
 */
import fs from 'node:fs';
import path from 'node:path';
import { zipSync } from 'fflate';

const RAIZ = process.cwd();
const DESTINO = process.argv[2] || path.join(RAIZ, 'luarys-codigo.zip');

const INCLUIR = [
  'src',                   // rotas, hooks, telas, libs
  'supabase/migrations',   // banco e RLS
  'scripts',               // ferramentas de conferência
  'package.json',          // dependências e scripts — faltou no pacote anterior
  'tsconfig.json',
  'next.config.ts',
  'next.config.js',
  'middleware.ts',
  'CLAUDE.md',
];

// Segredo nunca entra, mesmo que caia dentro de uma pasta permitida.
const PROIBIDO = [
  /(^|[/\\])\.env/i,
  /(^|[/\\])node_modules([/\\]|$)/,
  /(^|[/\\])\.next([/\\]|$)/,
  /(^|[/\\])\.git([/\\]|$)/,
  /\.(pfx|p12|key|pem|crt)$/i,
  /backup-limpeza|pareamento-/i,   // resultado de execução: leva nome de cliente
];

const arquivos = {};
const bloqueados = [];

function anda(rel) {
  const abs = path.join(RAIZ, rel);
  if (!fs.existsSync(abs)) return;

  if (PROIBIDO.some((re) => re.test(rel))) { bloqueados.push(rel); return; }

  const st = fs.statSync(abs);
  if (st.isDirectory()) {
    for (const f of fs.readdirSync(abs)) anda(path.join(rel, f));
    return;
  }
  arquivos[rel.split(path.sep).join('/')] = new Uint8Array(fs.readFileSync(abs));
}

for (const alvo of INCLUIR) anda(alvo);

const zip = zipSync(arquivos, { level: 9 });
fs.writeFileSync(DESTINO, zip);

const porExt = {};
for (const f of Object.keys(arquivos)) {
  const e = path.extname(f) || '(sem extensão)';
  porExt[e] = (porExt[e] || 0) + 1;
}

console.log(`\n${DESTINO}`);
console.log(`  ${Object.keys(arquivos).length} arquivos · ${(zip.length / 1024 / 1024).toFixed(1)} MB`);
console.log('  por tipo:', Object.entries(porExt).sort((a, b) => b[1] - a[1]).map(([e, n]) => `${e} ${n}`).join(' · '));
if (bloqueados.length) console.log('\n  bloqueados por segurança:', bloqueados.join(', '));

/**
 * Recupera chave de acesso, protocolo, RPS, base e ISS a partir dos XML já
 * guardados no bucket.
 *
 * A emissão lia esses campos do JSON da Brasil NFe, em nomes que não existem
 * na resposta: de 486 notas emitidas, 486 salvaram o XML e apenas **uma**
 * guardou a chave. As outras 485 ficaram sem a prova da emissão — a chave é o
 * que abre a nota no portal nacional, fora do nosso banco.
 *
 * O XML tem tudo, e já está com a gente. Isto é leitura e gravação local: não
 * fala com a Brasil NFe, não emite nada, não altera nota nenhuma na prefeitura.
 *
 * Só preenche campo VAZIO. Nota que já tem chave não é tocada — se o valor
 * gravado divergir do XML, isso é reportado em vez de sobrescrito, porque
 * sobrescrever esconderia justamente o caso interessante.
 *
 *   node scripts/conferencia/recuperar-chave-do-xml.mjs            (ensaio)
 *   node scripts/conferencia/recuperar-chave-do-xml.mjs --aplicar
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

// Mesma leitura de src/lib/nfse/brasilnfe.ts. Repetida aqui de propósito: um
// script de recuperação não deve depender do build do app para rodar.
function lerXmlNFSe(xml) {
  const tag = nome => xml.match(new RegExp(`<${nome}>([^<]*)</${nome}>`))?.[1]?.trim() || undefined;
  const num = v => (v === undefined || v === '' ? undefined : Number(v));
  return {
    chave_acesso: xml.match(/<infNFSe[^>]*\bId="NFS(\d{50})"/)?.[1],
    numero_nota: tag('nNFSe'),
    rps_numero: tag('nDPS'),
    protocolo_sefaz: tag('nDFSe'),
    autorizado: tag('cStat') === '100',
    data_autorizacao: tag('dhProc'),
    base_calculo: num(tag('vServ')),
    valor_iss: num(tag('vTotTribMun')),
  };
}

const { data: notas, error } = await admin.from('notas_fiscais')
  .select('id, numero_nota, storage_path_xml, chave_acesso, protocolo_sefaz, rps_numero, base_calculo, valor_iss, data_emissao')
  .not('storage_path_xml', 'is', null);
if (error) { console.log('não consegui ler as notas:', error.message); process.exit(1); }

console.log(`${notas.length} notas com XML guardado\n`);

const paraGravar = [];
const divergentes = [];
const semLer = [];

for (const n of notas) {
  const caminho = n.storage_path_xml.replace(/^notas-fiscais\//, '');
  const { data: blob, error: e } = await admin.storage.from('notas-fiscais').download(caminho);
  if (e) { semLer.push({ id: n.id, motivo: e.message }); continue; }

  const x = lerXmlNFSe(await blob.text());
  if (!x.chave_acesso) { semLer.push({ id: n.id, motivo: 'XML sem chave no infNFSe/@Id' }); continue; }

  if (n.chave_acesso && n.chave_acesso !== x.chave_acesso) {
    divergentes.push({ id: n.id, banco: n.chave_acesso, xml: x.chave_acesso });
    continue;
  }

  // Só o que está faltando.
  const campos = {};
  if (!n.chave_acesso) campos.chave_acesso = x.chave_acesso;
  if (!n.protocolo_sefaz && x.protocolo_sefaz) campos.protocolo_sefaz = x.protocolo_sefaz;
  if (!n.rps_numero && x.rps_numero) campos.rps_numero = x.rps_numero;
  if (n.base_calculo == null && x.base_calculo != null) campos.base_calculo = x.base_calculo;
  if (n.valor_iss == null && x.valor_iss != null) campos.valor_iss = x.valor_iss;
  // A data de emissão gravada é a hora em que rodamos a emissão, não a que a
  // prefeitura processou. Corrige quando o XML discorda em mais de um dia —
  // diferença de horas é fuso, diferença de dias é competência errada.
  if (x.data_autorizacao) {
    const dias = Math.abs(new Date(x.data_autorizacao) - new Date(n.data_emissao ?? 0)) / 86_400_000;
    if (!n.data_emissao || dias > 1) campos.data_emissao = x.data_autorizacao;
  }

  if (Object.keys(campos).length) paraGravar.push({ id: n.id, numero: n.numero_nota, campos });
}

const conta = {};
for (const p of paraGravar) for (const c of Object.keys(p.campos)) conta[c] = (conta[c] || 0) + 1;

console.log('A PREENCHER:');
for (const [c, v] of Object.entries(conta).sort((a, b) => b[1] - a[1])) console.log(`  ${c.padEnd(18)} ${String(v).padStart(4)} notas`);
console.log(`\n  ${paraGravar.length} notas seriam atualizadas`);
if (paraGravar[0]) console.log(`  exemplo — nota ${paraGravar[0].numero}: ${JSON.stringify(paraGravar[0].campos)}`);

if (divergentes.length) {
  console.log(`\n*** ${divergentes.length} notas com chave DIFERENTE do XML — não serão tocadas:`);
  for (const d of divergentes.slice(0, 5)) console.log(`    ${d.id}  banco=${d.banco}  xml=${d.xml}`);
}
if (semLer.length) {
  console.log(`\n${semLer.length} XML não puderam ser lidos:`);
  for (const s of semLer.slice(0, 5)) console.log(`    ${s.id}  ${s.motivo}`);
}

if (!paraGravar.length) { console.log('\nNada a fazer.'); process.exit(0); }
if (!APLICAR) { console.log('\n(ensaio — rode com --aplicar para gravar)'); process.exit(0); }

const arquivo = `scripts/conferencia/backup-notas-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
fs.writeFileSync(arquivo, JSON.stringify(notas, null, 2));
console.log(`\nbackup gravado: ${arquivo}`);

let ok = 0;
for (const p of paraGravar) {
  const { error: e } = await admin.from('notas_fiscais').update(p.campos).eq('id', p.id);
  if (e) { console.log(`  ERRO na nota ${p.numero}: ${e.message}`); continue; }
  ok++;
}
console.log(`${ok} de ${paraGravar.length} notas atualizadas.`);

const { count: comChave } = await admin.from('notas_fiscais')
  .select('*', { count: 'exact', head: true }).not('cod_lote_brasilnfe', 'is', null).not('chave_acesso', 'is', null);
const { count: emitidas } = await admin.from('notas_fiscais')
  .select('*', { count: 'exact', head: true }).not('cod_lote_brasilnfe', 'is', null);
console.log(`\nDepois: ${comChave} de ${emitidas} notas emitidas têm chave de acesso.`);

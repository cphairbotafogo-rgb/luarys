/**
 * Põe cada serviço do piloto no NBS da sua classe.
 *
 * Ari, 07/08/2026: *"clase manicure, e estetica e assim por diante, os serviços
 * dentro de suas clases"*. O cadastro tinha só dois NBS para seis setores —
 * depilação e estética estavam junto com manicure em 126022000.
 *
 * `1.2602` é o grupo de beleza da NBS, e os desdobros separam as atividades:
 *
 *   126021000 (1.2602.10.00) — cabeleireiros e barbeiros
 *   126022000 (1.2602.20.00) — manicure, pedicure e tratamento cosmético
 *   126023000 (1.2602.30.00) — bem-estar: spa, sauna, massagem não terapêutica
 *   126029000 (1.2602.90.00) — outros tratamentos de beleza (depilação)
 *
 * O que a Trinks emitiu NÃO serve de referência aqui: lá "Design de
 * Sobrancelha" saiu ora em 126021000, ora em 126023000, e manicure e podologia
 * saíram em 126021000. A prefeitura aceitou tudo — o NBS não é validado na
 * emissão, então "foi aceito" não quer dizer "está certo".
 *
 * A tributação (`060101` + `005`) NÃO é tocada: essa é a mesma para tudo, por
 * ser o código do salão-parceiro optante pelo Simples, que cobre a operação
 * inteira. Dividi-la foi o que gerou a rejeição E0314.
 *
 *   node scripts/conferencia/classificar-nbs-por-classe.mjs           (ensaio)
 *   node scripts/conferencia/classificar-nbs-por-classe.mjs --aplicar
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const APLICAR = process.argv.includes('--aplicar');

// Conferido por Ari em 07/08/2026 contra a NBS oficial (Portaria Conjunta
// 1.820/2013 do MDIC), as Notas Explicativas e o Anexo VIII de correlação da
// NFS-e. Duas correções vieram daí, sobre a minha leitura anterior:
//   - depilação NÃO é 1.2602.30.00; é 1.2602.90.00, "outros tratamentos de
//     beleza";
//   - 1.2602.30.00 é bem-estar (spa, sauna, massagem não terapêutica). Nenhum
//     serviço do piloto cai aí hoje — procedimento cosmético é 1.2602.20.00.
const NBS_POR_SETOR = {
  'Cabeleireiro(a)': '126021000',  // 1.2602.10.00 cabeleireiros e barbeiros
  'Manicure':        '126022000',  // 1.2602.20.00 manicure, pedicure e trat. cosmético
  'Nail Designer':   '126022000',  // sem NBS própria — cai em manicure/pedicure
  'Podologia':       '126022000',  // podologia estética; Ari optou por manter junto de manicure
  'Estética':        '126022000',  // micropigmentação e facial são cosméticos
  'Depilação':       '126029000',  // 1.2602.90.00 outros tratamentos de beleza
};

// A categoria vence o setor: no piloto, 19 serviços de sobrancelha (design,
// henna, lamination) estão cadastrados dentro do setor "Depilação", mas design
// de sobrancelhas é tratamento cosmético, não depilação.
const NBS_POR_CATEGORIA = {
  'Sobrancelha': '126022000',
};

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(),
               l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]),
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const SAL = (await admin.from('saloes').select('id, razao_social').ilike('cnpj', '%17326293%')).data[0];
const { data: srv } = await admin.from('servicos')
  .select('id, nome_servico, setor, categoria, nbs, codigo_tributacao_nacional, codigo_municipio, aliquota_iss')
  .eq('salao_id', SAL.id);

console.log(`Salão: ${SAL.razao_social} · ${srv.length} serviços\n`);

const mudar = [];
const semRegra = [];
for (const s of srv) {
  const alvo = NBS_POR_CATEGORIA[s.categoria] ?? NBS_POR_SETOR[s.setor];
  if (!alvo) { semRegra.push(s); continue; }
  if (s.nbs !== alvo) mudar.push({ ...s, nbs_novo: alvo });
}

if (semRegra.length) {
  console.log('SEM REGRA DE CLASSE — não vou tocar:');
  for (const s of semRegra) console.log(`  setor=${s.setor ?? '(vazio)'} · ${s.nome_servico}`);
  console.log();
}

const porMudanca = {};
for (const m of mudar) {
  const k = `${String(m.setor).padEnd(16)} / ${String(m.categoria ?? '-').padEnd(18)} ${String(m.nbs ?? '(vazio)')} -> ${m.nbs_novo}`;
  (porMudanca[k] ||= []).push(m.nome_servico);
}
console.log(`${mudar.length} serviços a reclassificar:`);
for (const [k, v] of Object.entries(porMudanca).sort()) {
  console.log(`\n  ${k}   (${v.length})`);
  console.log('    ' + v.slice(0, 6).join(' | ').slice(0, 150) + (v.length > 6 ? ` ... +${v.length - 6}` : ''));
}

if (!mudar.length) { console.log('\nNada a fazer — já está classificado.'); process.exit(0); }
if (!APLICAR) { console.log('\n\n(ensaio — rode com --aplicar para gravar)'); process.exit(0); }

const carimbo = new Date().toISOString().replace(/[:.]/g, '-');
const arquivo = `scripts/conferencia/backup-nbs-${carimbo}.json`;
fs.writeFileSync(arquivo, JSON.stringify(srv, null, 2), 'utf8');
console.log(`\n\nbackup gravado: ${arquivo}`);

let feitos = 0;
for (const m of mudar) {
  const { error } = await admin.from('servicos').update({ nbs: m.nbs_novo }).eq('id', m.id);
  if (error) { console.log(`  ERRO em ${m.nome_servico}: ${error.message}`); continue; }
  feitos++;
}
console.log(`${feitos} de ${mudar.length} serviços atualizados.`);

const { data: depois } = await admin.from('servicos')
  .select('setor, categoria, nbs, codigo_tributacao_nacional, codigo_municipio, aliquota_iss').eq('salao_id', SAL.id);
const c = {};
for (const s of depois) {
  const cat = NBS_POR_CATEGORIA[s.categoria] ? ` / ${s.categoria}` : '';
  const k = `${(String(s.setor ?? '(sem setor)') + cat).padEnd(30)} NBS=${String(s.nbs ?? '(vazio)').padEnd(11)} nac=${s.codigo_tributacao_nacional ?? '-'} mun=${s.codigo_municipio ?? '(vazio)'} aliq=${s.aliquota_iss}`;
  c[k] = (c[k] || 0) + 1;
}
console.log('\nDEPOIS — cada classe com um código só:');
for (const [k, v] of Object.entries(c).sort()) console.log(`  ${k}  ${String(v).padStart(4)}`);

const classes = {};
for (const s of depois) {
  if (!s.setor) continue;
  const chave = NBS_POR_CATEGORIA[s.categoria] ? `categoria ${s.categoria}` : `setor ${s.setor}`;
  (classes[chave] ||= new Set()).add(s.nbs);
}
const furos = Object.entries(classes).filter(([, v]) => v.size > 1);
console.log(furos.length
  ? `\n*** ATENCAO: classes com mais de um NBS: ${furos.map(([k, v]) => k + ' (' + [...v].join(', ') + ')').join(' · ')}`
  : '\nConferido: nenhuma classe tem mais de um NBS.');

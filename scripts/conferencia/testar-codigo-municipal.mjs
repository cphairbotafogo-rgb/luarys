/**
 * Testa um código de tributação municipal contra a homologação da prefeitura,
 * ANTES de trocar o cadastro dos serviços.
 *
 * Foi assim que o 060220 da estética apareceu: candidatos enviados um a um até
 * a prefeitura parar de responder E0314. O contrário — trocar o cadastro e
 * descobrir no dia da emissão — já custou uma leva inteira de notas rejeitadas.
 *
 * Emite em homologação (TipoAmbiente 2). Nada chega à prefeitura de verdade.
 *
 * Uso: node scripts/conferencia/testar-codigo-municipal.mjs <cTribNac> <cTribMun>[,<outro>...]
 *   node scripts/conferencia/testar-codigo-municipal.mjs 060101 060120,005,060104
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import pkg from 'brasilnfe';

const { BrasilNFe } = pkg;
const [NAC, MUNS] = process.argv.slice(2);
if (!NAC || !MUNS) {
  console.error('uso: testar-codigo-municipal.mjs <cTribNac> <cTribMun>[,<outro>...]');
  process.exit(1);
}

const env = {};
for (const l of fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: sal } = await db.from('saloes')
  .select('config_fiscal, cnae, inscricao_municipal, nome_fantasia')
  .eq('nome_fantasia', 'Concept Prime Hair').maybeSingle();

const token = sal?.config_fiscal?.brasilnfe_company_token;
if (!token) { console.error('salão sem company token da Brasil NFe'); process.exit(1); }

// A data precisa nascer no fuso de São Paulo. Montar em UTC e rotular "-03:00"
// joga o horário 3h para o futuro e a prefeitura devolve E0008.
const agora = new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).replace(' ', 'T');
const hoje = agora.slice(0, 10);

const bnfe = new BrasilNFe(token);

console.log(`\ncTribNac ${NAC} — testando ${MUNS.split(',').length} código(s) municipal(is)\n`);

for (const mun of MUNS.split(',').map((s) => s.trim()).filter(Boolean)) {
  process.stdout.write(`  ${mun.padEnd(10)} `);
  try {
    const resp = await bnfe.notaFiscal.enviarNotaFiscalServico({
      TipoAmbiente: 2, // homologação, sempre
      nFSInfo: [{
        IdentificadorInterno: `teste-cod-${mun}-${Date.now()}`,
        DataEmissao: `${agora}-03:00`,
        DataCompetencia: hoje,
        Tomador: { RazaoSocial: 'Consumidor Final' },
        Servico: {
          Descricao: 'Teste de codigo de tributacao municipal',
          ItemListaServico: NAC,
          NaturezaOperacao: 1,
          IncentivadorCultural: false,
          IssRetido: false,
          CodTributacaoMunicipio: mun,
          CodigoCnae: String(sal.cnae ?? '').replace(/\D/g, '') || undefined,
          Valores: { ValorServico: 1, Aliquota: 5, ValorDeducoes: 0 },
        },
      }],
    });

    if (resp.Error) { console.log('ERRO DA API  ', String(resp.Error).slice(0, 100)); continue; }
    const nota = resp.Notas?.[0];
    if (resp.StatusLote === 2) { console.log('em processamento (lote aceito)'); continue; }
    if (nota?.Status === 1) console.log('ACEITO');
    else console.log('recusado    ', String(nota?.Erro ?? 'sem mensagem').slice(0, 110));
  } catch (e) {
    console.log('FALHA       ', String(e?.message ?? e).slice(0, 110));
  }
}
console.log('\n(notas de teste ficam em homologação; nada chega à prefeitura)');

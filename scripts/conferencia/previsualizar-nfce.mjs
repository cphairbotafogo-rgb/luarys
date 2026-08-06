/**
 * Pré-visualiza uma NFC-e com dados reais do salão, sem tocar na SEFAZ.
 *
 * Por que existe: o módulo de NFC-e nunca emitiu nada — zero notas na plataforma
 * inteira. Descobrir que o payload está errado na primeira venda de produto é o
 * pior momento possível. O endpoint de pré-visualização da Brasil NFe monta o
 * documento e devolve XML ou PDF sem contatar a SEFAZ, sem gerar protocolo, sem
 * consumir numeração e sem custo — é o teste que dá para fazer hoje.
 *
 * O mapeamento aqui espelha src/lib/nfce/brasilnfe.ts de propósito: o objetivo é
 * testar o que o sistema realmente manda, não um payload ideal escrito à mão.
 *
 * Uso: node scripts/conferencia/previsualizar-nfce.mjs "<salão>" [--pdf]
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import pkg from 'brasilnfe';

const { BrasilNFe } = pkg;
const SALAO = process.argv.slice(2).filter((a) => !a.startsWith('--'))[0] || 'Concept Prime Hair';
const PDF = process.argv.includes('--pdf');

const env = {};
for (const l of fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: sal } = await db.from('saloes')
  .select('id, nome_fantasia, cnpj, config_fiscal, cidade, uf, cep').eq('nome_fantasia', SALAO).maybeSingle();
if (!sal) { console.error(`salão "${SALAO}" não encontrado`); process.exit(1); }

const token = sal.config_fiscal?.brasilnfe_company_token;
if (!token) { console.error('salão sem company token da Brasil NFe'); process.exit(1); }

const { data: produtos } = await db.from('produtos')
  .select('id, nome_produto, preco_venda, ncm, cfop_padrao, csosn_padrao, origem, unidade_medida, codigo_sku')
  .eq('salao_id', sal.id).limit(3);

if (!produtos?.length) { console.error('salão sem produto cadastrado — nada a pré-visualizar'); process.exit(1); }

console.log(`\nsalão: ${sal.nome_fantasia}   produtos: ${produtos.length}`);
for (const p of produtos) {
  const faltando = [!p.ncm && 'NCM', !p.cfop_padrao && 'CFOP', !p.csosn_padrao && 'CSOSN', p.origem == null && 'origem']
    .filter(Boolean);
  console.log(`   ${String(p.nome_produto).slice(0, 30).padEnd(31)} R$ ${Number(p.preco_venda || 0).toFixed(2).padStart(8)}` +
    (faltando.length ? `   FALTA: ${faltando.join(', ')}` : '   completo'));
}

// Data no fuso de São Paulo. Montar em UTC e rotular "-03:00" joga a emissão
// para o futuro e a SEFAZ recusa.
const agora = new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).replace(' ', 'T');

// Espelha src/lib/nfce/brasilnfe.ts. Serie/Numero/Lote omitidos de propósito:
// a Brasil NFe numera sozinha por empresa+modelo+ambiente quando não vêm.
const total = produtos.reduce((a, p) => a + Number(p.preco_venda || 0), 0);
const notaFiscal = {
  TipoAmbiente: 2,
  ModeloDocumento: 65,
  Finalidade: 1,
  NaturezaOperacao: 'VENDA AO CONSUMIDOR',
  IndicadorPresenca: Number(sal.config_fiscal?.presenca_comprador) || 1,
  ConsumidorFinal: true,
  DataEmissao: `${agora}-03:00`,
  Produtos: produtos.map((p) => ({
    CodProdutoServico: p.codigo_sku || String(p.id).slice(0, 8),
    NmProduto: p.nome_produto,
    NCM: p.ncm || undefined,
    CFOP: Number(p.cfop_padrao) || 5102,
    UnidadeComercial: p.unidade_medida || 'UN',
    Quantidade: 1,
    ValorUnitario: Number(p.preco_venda || 0),
    ValorTotal: Number(p.preco_venda || 0),
    OrigemProduto: Number(p.origem) || 0,
    Imposto: {
      ICMS: { CodSituacaoTributaria: p.csosn_padrao || '102' },
      PIS: { CodSituacaoTributaria: '49' },
      COFINS: { CodSituacaoTributaria: '49' },
    },
  })),
  Pagamentos: [{ IndicadorPagamento: 0, FormaPagamento: '01', VlPago: total }],
};

const bnfe = new BrasilNFe(token);
console.log(`\nvalor da nota: R$ ${total.toFixed(2)}   ambiente: homologação   (sem SEFAZ, sem protocolo)\n`);

try {
  const resp = await bnfe.consultas.preVisualizarNotaFiscal({
    notaFiscal: { nFInfos: [notaFiscal] },
    TipoEnvio: 1,                 // 1 = objeto
    TipoArquivo: PDF ? 1 : 0,     // 0 = XML, 1 = PDF
    mostrarTarjaPreVisualizacao: true,
  });

  if (resp.Error) { console.log('RECUSADO:', resp.Error); process.exit(1); }
  if (!resp.Base64File) { console.log('sem arquivo no retorno:', JSON.stringify(resp).slice(0, 400)); process.exit(1); }

  const bin = Buffer.from(resp.Base64File, 'base64');
  const arq = path.join(process.cwd(), `scripts/conferencia/previa-nfce.${PDF ? 'pdf' : 'xml'}`);
  fs.writeFileSync(arq, bin);
  console.log(`ACEITO — ${bin.length} bytes em ${arq}`);
  if (resp.Avisos?.length) console.log('avisos:', resp.Avisos.join(' | '));
  if (!PDF) console.log('\n' + bin.toString('utf8').slice(0, 1400));
} catch (e) {
  console.log('FALHA:', String(e?.message ?? e).slice(0, 400));
}

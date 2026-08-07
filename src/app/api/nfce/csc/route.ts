/**
 * POST /api/nfce/csc
 *
 * Envia o CSC (Código de Segurança do Contribuinte) do salão para a Brasil NFe.
 *
 * O CSC é emitido pela SEFAZ do estado e assina o QR Code do DANFE NFC-e —
 * sem ele a nota de consumidor não é autorizada. Ele fica na configuração da
 * EMPRESA no provedor, não no payload da nota.
 *
 * Não gravamos o CSC no nosso banco. Mesma regra do certificado A1: credencial
 * de cliente atravessa o sistema e fica com o provedor. Guardar aqui só criaria
 * mais um lugar de onde vazar, sem nenhum uso — quem assina a nota é a Brasil
 * NFe, não nós.
 *
 * Body: { csc_id_homologacao?, csc_homologacao?, csc_id_producao?, csc_producao? }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { autenticarRota } from '@/lib/apiAuth';
import { submeterCscNFCe } from '@/lib/nfse/brasilnfe';
import { BrasilNFe } from 'brasilnfe';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET — diz se o CSC está configurado, perguntando ao PROVEDOR.
 *
 * A fonte é ele, não o nosso banco: como não guardamos o código aqui, olhar
 * para cá diria "vazio" mesmo com tudo funcionando — foi exatamente a impressão
 * que a tela deu quando o campo esvaziou depois de salvar. Devolve só se existe,
 * nunca o valor.
 */
export async function GET(req: NextRequest) {
  const { perfil, erro } = await autenticarRota(req, 'GET /api/nfce/csc');
  if (erro) return erro;

  const { data: salao } = await supabaseAdmin
    .from('saloes').select('config_fiscal').eq('id', perfil!.salao_id).maybeSingle();
  const companyToken = salao?.config_fiscal?.brasilnfe_company_token;
  if (!companyToken) return NextResponse.json({ homologacao: false, producao: false });

  const { data: cfg } = await supabaseAdmin
    .from('plataforma_nfse_config').select('token_brasilnfe').eq('id', 1).maybeSingle();
  const userToken = process.env.BRASIL_NFE_USER_TOKEN || cfg?.token_brasilnfe || '';
  if (!userToken) return NextResponse.json({ homologacao: false, producao: false });

  try {
    const bnfe = new BrasilNFe(companyToken, userToken);
    const empresa = await bnfe.empresa.buscarEmpresa();
    const n = empresa?.Configuracao?.NFCe ?? {};
    return NextResponse.json({
      homologacao: Boolean(n.IdCSCHomologacao && n.CSCHomologacao),
      producao:    Boolean(n.IdCSCProducao && n.CSCProducao),
      id_homologacao: n.IdCSCHomologacao ?? null,
      id_producao:    n.IdCSCProducao ?? null,
      enviado_em: salao?.config_fiscal?.csc_enviado_em ?? null,
    });
  } catch {
    return NextResponse.json({ homologacao: false, producao: false });
  }
}

export async function POST(req: NextRequest) {
  const { perfil, erro } = await autenticarRota(req, 'POST /api/nfce/csc');
  if (erro) return erro;

  const body = await req.json().catch(() => ({}));

  const { data: salao } = await supabaseAdmin
    .from('saloes').select('config_fiscal').eq('id', perfil!.salao_id).maybeSingle();
  const companyToken = salao?.config_fiscal?.brasilnfe_company_token;
  if (!companyToken) {
    return NextResponse.json({ erro: 'Módulo fiscal ainda não ativado para este salão.' }, { status: 422 });
  }

  const { data: cfg } = await supabaseAdmin
    .from('plataforma_nfse_config').select('token_brasilnfe').eq('id', 1).maybeSingle();
  const userToken = process.env.BRASIL_NFE_USER_TOKEN || cfg?.token_brasilnfe || '';
  if (!userToken) {
    return NextResponse.json({ erro: 'Configuração da plataforma incompleta. Fale com o suporte.' }, { status: 422 });
  }

  const resultado = await submeterCscNFCe(companyToken, userToken, {
    idHomologacao:  body?.csc_id_homologacao,
    cscHomologacao: body?.csc_homologacao,
    idProducao:     body?.csc_id_producao,
    cscProducao:    body?.csc_producao,
  });

  if (!resultado.sucesso) {
    return NextResponse.json({ erro: resultado.erro }, { status: 422 });
  }

  // Registra que foi enviado, sem registrar o quê. Serve para a tela mostrar
  // "configurado em <data>" sem guardar a credencial.
  await supabaseAdmin.from('saloes').update({
    config_fiscal: { ...(salao!.config_fiscal || {}), csc_enviado_em: new Date().toISOString() },
  }).eq('id', perfil!.salao_id);

  return NextResponse.json({ sucesso: true });
}

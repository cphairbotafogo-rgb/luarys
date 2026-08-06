/**
 * GET  /api/nfse/numeracao        — numeração do próprio salão
 * POST /api/nfse/numeracao        — define como a numeração de produção continua
 *
 * Existe porque a numeração pertence ao CNPJ, não ao software. A prefeitura
 * controla por prestador + série e não sabe qual sistema enviou. Um salão que já
 * emitiu por outro emissor não pode recomeçar do 1 — repetiria documento já
 * autorizado.
 *
 * O provedor só conhece o que ele próprio enviou, então o contador de produção
 * nasce em 1 mesmo para CNPJ com histórico. Alguém precisa dizer como continuar,
 * e essa decisão é do salão com a contabilidade — não do Luarys.
 *
 * Duas formas, ambas aceitas aqui:
 *   'continuar'  → mesma série, próximo número = último autorizado + 1
 *   'nova_serie' → série nova começando em 1, sem risco de colisão
 *
 * Body: { modo: 'continuar' | 'nova_serie', ultimo_numero?, serie?, confirmo: true }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { BrasilNFe } from 'brasilnfe';
import { autenticarRota } from '@/lib/apiAuth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MODELO_NFSE = 10;

/** Token da empresa + UserToken master — os métodos de Empresa exigem os dois. */
async function tokens(salaoId: string) {
  const { data: salao } = await supabaseAdmin
    .from('saloes').select('config_fiscal').eq('id', salaoId).maybeSingle();
  const companyToken = salao?.config_fiscal?.brasilnfe_company_token;
  if (!companyToken) return { erro: 'Módulo fiscal ainda não ativado para este salão.' };

  const { data: cfg } = await supabaseAdmin
    .from('plataforma_nfse_config').select('token_brasilnfe').eq('id', 1).maybeSingle();
  const userToken = process.env.BRASIL_NFE_USER_TOKEN || cfg?.token_brasilnfe || '';
  if (!userToken) return { erro: 'Configuração da plataforma incompleta. Fale com o suporte.' };

  return { companyToken, userToken };
}

export async function GET(req: NextRequest) {
  const { perfil, erro } = await autenticarRota(req, 'GET /api/nfse/numeracao');
  if (erro) return erro;

  const t = await tokens(perfil!.salao_id);
  if (t.erro) return NextResponse.json({ erro: t.erro }, { status: 422 });

  try {
    const bnfe = new BrasilNFe(t.companyToken!, t.userToken!);
    const resp = await bnfe.empresa.consultarNumeracao();
    if (!resp?.status) return NextResponse.json({ erro: resp?.Error || 'Não foi possível consultar a numeração.' }, { status: 422 });

    // Só NFS-e. O salão não precisa ver contador de CT-e ou MDF-e.
    const nfse = (resp.Numeracoes ?? []).filter(n => Number(n.ModeloDocumento) === MODELO_NFSE);
    return NextResponse.json({
      producao:    nfse.filter(n => n.TipoAmbiente === 1),
      homologacao: nfse.filter(n => n.TipoAmbiente === 2),
    });
  } catch (e: any) {
    return NextResponse.json({ erro: 'Erro ao consultar: ' + (e?.message || String(e)) }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const { perfil, erro } = await autenticarRota(req, 'POST /api/nfse/numeracao');
  if (erro) return erro;

  const body = await req.json().catch(() => ({}));
  const { modo, ultimo_numero, serie, confirmo } = body ?? {};

  if (confirmo !== true) {
    return NextResponse.json({ erro: 'Confirme a escolha antes de gravar.' }, { status: 428 });
  }

  let serieFinal: string;
  let proximoNumero: number;

  if (modo === 'continuar') {
    const ultimo = Number(ultimo_numero);
    if (!Number.isInteger(ultimo) || ultimo < 0) {
      return NextResponse.json({ erro: 'Informe o número da última nota já autorizada.' }, { status: 400 });
    }
    serieFinal = String(serie || '1').trim() || '1';
    proximoNumero = ultimo + 1;
  } else if (modo === 'nova_serie') {
    serieFinal = String(serie || '').trim();
    if (!serieFinal) return NextResponse.json({ erro: 'Informe a identificação da nova série.' }, { status: 400 });
    if (serieFinal === '1') {
      return NextResponse.json({
        erro: 'A série 1 já está em uso. Escolha outra identificação para a série nova.',
      }, { status: 400 });
    }
    proximoNumero = 1;
  } else {
    return NextResponse.json({ erro: 'modo deve ser "continuar" ou "nova_serie".' }, { status: 400 });
  }

  const t = await tokens(perfil!.salao_id);
  if (t.erro) return NextResponse.json({ erro: t.erro }, { status: 422 });

  try {
    const bnfe = new BrasilNFe(t.companyToken!, t.userToken!);
    const resp = await bnfe.empresa.atualizarNumeracao({
      TipoAmbiente: 1,               // produção — homologação é ambiente de teste, não tem efeito
      ModeloDocumento: MODELO_NFSE,
      Serie: serieFinal,
      Numero: proximoNumero,
      Padrao: true,                  // é dela que a emissão parte quando não informamos série
    });
    if (!resp?.status) return NextResponse.json({ erro: resp?.Error || 'A Brasil NFe recusou a alteração.' }, { status: 422 });

    console.warn(`[numeracao] salão ${perfil!.salao_id} · NFS-e produção · série ${serieFinal} → próximo ${proximoNumero} (modo ${modo})`);
    return NextResponse.json({ sucesso: true, serie: serieFinal, proximo_numero: proximoNumero });
  } catch (e: any) {
    return NextResponse.json({ erro: 'Erro ao gravar: ' + (e?.message || String(e)) }, { status: 502 });
  }
}

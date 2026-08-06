/**
 * GET  /api/admin/brasilnfe/numeracao?salao_id=...
 * POST /api/admin/brasilnfe/numeracao
 *
 * Lê e ajusta a numeração de documento fiscal que a Brasil NFe mantém por
 * empresa + ambiente + modelo + série.
 *
 * Por que existe: a numeração de produção de um salão novo começa em 1. Se o
 * CNPJ já emitiu notas por outro sistema, a primeira emissão pelo Luarys repete
 * números já autorizados. A documentação da Brasil NFe é explícita:
 * "nunca defina `Numero` igual ou inferior a um número já autorizado".
 *
 * Esta rota NÃO decide o número — mostra o que existe e grava o que o
 * administrador informar. A responsabilidade fiscal continua sendo de quem
 * define, e por isso o valor exige confirmação explícita no corpo do POST.
 *
 * Body do POST: { salao_id, tipo_ambiente, modelo_documento, serie, numero, padrao?, confirmo: true }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { BrasilNFe } from 'brasilnfe';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Modelos que a plataforma emite hoje. Os outros o SDK aceita, mas não usamos. */
const MODELOS: Record<number, string> = { 10: 'NFS-e', 55: 'NF-e', 65: 'NFC-e' };

async function autenticarAdmin(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return { erro: NextResponse.json({ erro: 'Não autorizado' }, { status: 401 }) };

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return { erro: NextResponse.json({ erro: 'Sessão inválida' }, { status: 401 }) };

  const { data: perfil } = await supabaseAdmin
    .from('perfis_usuarios').select('is_plataforma_admin').eq('id', user.id).maybeSingle();

  if (!perfil?.is_plataforma_admin) {
    return { erro: NextResponse.json({ erro: 'Acesso restrito a administradores da plataforma.' }, { status: 403 }) };
  }
  return {};
}

/** Token da empresa + UserToken master — os dois são exigidos pelos métodos de Empresa. */
async function tokens(salaoId: string) {
  const { data: salao } = await supabaseAdmin
    .from('saloes').select('nome_fantasia, config_fiscal').eq('id', salaoId).maybeSingle();
  const companyToken = salao?.config_fiscal?.brasilnfe_company_token;
  if (!companyToken) return { erro: 'Salão ainda não cadastrado na Brasil NFe.' };

  const { data: cfg } = await supabaseAdmin
    .from('plataforma_nfse_config').select('token_brasilnfe').eq('id', 1).maybeSingle();
  const userToken = process.env.BRASIL_NFE_USER_TOKEN || cfg?.token_brasilnfe || '';
  if (!userToken) return { erro: 'UserToken Brasil NFe não configurado (Admin → NFS-e Luarys).' };

  return { companyToken, userToken, nome: salao?.nome_fantasia as string };
}

export async function GET(req: NextRequest) {
  const auth = await autenticarAdmin(req);
  if (auth.erro) return auth.erro;

  const salaoId = req.nextUrl.searchParams.get('salao_id');
  if (!salaoId) return NextResponse.json({ erro: 'salao_id obrigatório' }, { status: 400 });

  const t = await tokens(salaoId);
  if (t.erro) return NextResponse.json({ erro: t.erro }, { status: 422 });

  try {
    const bnfe = new BrasilNFe(t.companyToken!, t.userToken!);
    const resp = await bnfe.empresa.consultarNumeracao();
    if (!resp?.status) return NextResponse.json({ erro: resp?.Error || 'Brasil NFe não devolveu a numeração.' }, { status: 422 });

    // Só o que a plataforma emite — o resto do retorno é ruído para quem lê a tela.
    const numeracoes = (resp.Numeracoes ?? [])
      .filter(n => MODELOS[Number(n.ModeloDocumento)])
      .map(n => ({
        ...n,
        modelo_nome: MODELOS[Number(n.ModeloDocumento)],
        ambiente_nome: n.TipoAmbiente === 1 ? 'Produção' : 'Homologação',
      }));

    return NextResponse.json({ salao: t.nome, numeracoes });
  } catch (e: any) {
    return NextResponse.json({ erro: 'Erro ao consultar a Brasil NFe: ' + (e?.message || String(e)) }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await autenticarAdmin(req);
  if (auth.erro) return auth.erro;

  const body = await req.json().catch(() => ({}));
  const { salao_id, tipo_ambiente, modelo_documento, serie, numero, padrao, confirmo } = body ?? {};

  if (!salao_id) return NextResponse.json({ erro: 'salao_id obrigatório' }, { status: 400 });
  if (![1, 2].includes(Number(tipo_ambiente))) return NextResponse.json({ erro: 'tipo_ambiente deve ser 1 (produção) ou 2 (homologação).' }, { status: 400 });
  if (!MODELOS[Number(modelo_documento)]) return NextResponse.json({ erro: 'modelo_documento não suportado.' }, { status: 400 });
  if (!Number.isInteger(Number(numero)) || Number(numero) < 1) return NextResponse.json({ erro: 'numero deve ser inteiro maior que zero.' }, { status: 400 });

  // Trava deliberada: alterar numeração pode gerar rejeição por documento
  // duplicado, e isso não se desfaz. Exige o aceite explícito de quem chama.
  if (confirmo !== true) {
    return NextResponse.json({
      erro: 'Confirme a alteração enviando confirmo: true. Número igual ou inferior a um já autorizado causa rejeição por duplicidade.',
    }, { status: 428 });
  }

  const t = await tokens(salao_id);
  if (t.erro) return NextResponse.json({ erro: t.erro }, { status: 422 });

  try {
    const bnfe = new BrasilNFe(t.companyToken!, t.userToken!);
    const resp = await bnfe.empresa.atualizarNumeracao({
      TipoAmbiente: Number(tipo_ambiente),
      ModeloDocumento: Number(modelo_documento),
      Serie: String(serie ?? '1'),
      Numero: Number(numero),
      Padrao: padrao !== false,
    });
    if (!resp?.status) return NextResponse.json({ erro: resp?.Error || 'Brasil NFe recusou a alteração.' }, { status: 422 });

    console.warn(`[numeracao] salão ${salao_id} · ${MODELOS[Number(modelo_documento)]} · ambiente ${tipo_ambiente} · série ${serie ?? '1'} → ${numero}`);
    return NextResponse.json({ sucesso: true, numeracao: resp.Numeracao });
  } catch (e: any) {
    return NextResponse.json({ erro: 'Erro ao atualizar na Brasil NFe: ' + (e?.message || String(e)) }, { status: 502 });
  }
}

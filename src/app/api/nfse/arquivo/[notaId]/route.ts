/**
 * GET /api/nfse/arquivo/[notaId]?tipo=nfse|nfce&arquivo=pdf|xml|danfe
 *
 * Gera uma signed URL de curta duração pro XML/PDF/DANFE de uma nota emitida
 * via Brasil NFe, guardado no bucket privado `notas-fiscais`. A Brasil NFe
 * devolve esses arquivos em base64 no corpo da resposta (não como link
 * público como a Focus NFe fazia) — por isso o caminho no Storage é resolvido
 * aqui, checando posse da nota antes, em vez de expor uma URL fixa.
 *
 * `notaId` é o id de `notas_fiscais` pra tipo=nfse, ou a `referencia`
 * (identificador único legível, ex. "nfce-<salao>-<numero>") de
 * `nfce_emissoes` pra tipo=nfce — mesma chave que /api/nfce/emitir já
 * devolve na hora, sem precisar de um segundo round-trip pra descobrir o id.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { autenticarRota } from '@/lib/apiAuth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET_NOTAS = 'notas-fiscais';
const SEGUNDOS_EXPIRACAO = 60;

export async function GET(req: NextRequest, { params }: { params: Promise<{ notaId: string }> }) {
  const { notaId } = await params;
  const { perfil, erro } = await autenticarRota(req, 'GET /api/nfse/arquivo');
  if (erro) return erro;

  const tipo = req.nextUrl.searchParams.get('tipo');
  const arquivo = req.nextUrl.searchParams.get('arquivo');

  if (tipo !== 'nfse' && tipo !== 'nfce') {
    return NextResponse.json({ erro: 'Parâmetro "tipo" inválido — use nfse ou nfce.' }, { status: 400 });
  }
  if (arquivo !== 'pdf' && arquivo !== 'xml' && arquivo !== 'danfe') {
    return NextResponse.json({ erro: 'Parâmetro "arquivo" inválido — use pdf, xml ou danfe.' }, { status: 400 });
  }

  let caminho: string | null = null;

  if (tipo === 'nfse') {
    const coluna = arquivo === 'xml' ? 'storage_path_xml' : 'storage_path_pdf';
    const { data: nota } = await supabaseAdmin
      .from('notas_fiscais')
      .select(`salao_id, ${coluna}`)
      .eq('id', notaId)
      .maybeSingle();

    if (!nota || nota.salao_id !== perfil!.salao_id) {
      return NextResponse.json({ erro: 'Não autorizado.' }, { status: 403 });
    }
    caminho = (nota as any)[coluna] ?? null;
  } else {
    const coluna = arquivo === 'xml' ? 'storage_path_xml' : 'storage_path_danfe';
    const { data: nota } = await supabaseAdmin
      .from('nfce_emissoes')
      .select(`salao_id, ${coluna}`)
      .eq('referencia', notaId)
      .maybeSingle();

    if (!nota || nota.salao_id !== perfil!.salao_id) {
      return NextResponse.json({ erro: 'Não autorizado.' }, { status: 403 });
    }
    caminho = (nota as any)[coluna] ?? null;
  }

  if (!caminho) {
    return NextResponse.json({ erro: 'Arquivo ainda não disponível para esta nota.' }, { status: 404 });
  }

  const { data: signed, error: erroSigned } = await supabaseAdmin
    .storage
    .from(BUCKET_NOTAS)
    .createSignedUrl(caminho, SEGUNDOS_EXPIRACAO);

  if (erroSigned || !signed?.signedUrl) {
    console.error('[nfse/arquivo] falha ao gerar signed URL:', erroSigned?.message);
    return NextResponse.json({ erro: 'Não foi possível gerar o link do arquivo.' }, { status: 500 });
  }

  return NextResponse.json({ url: signed.signedUrl });
}

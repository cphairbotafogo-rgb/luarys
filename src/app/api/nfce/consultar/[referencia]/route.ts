import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { consultarNFCe } from '@/lib/nfce/focusnfe';
import { autenticarRota } from '@/lib/apiAuth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest, { params }: { params: Promise<{ referencia: string }> }) {
  // Next.js 16: params é Promise — precisa de await.
  const { referencia } = await params;
  // Verifica ownership — a referência NFC-e começa com nfce-{salao_id}-{numero}
  const { perfil, erro } = await autenticarRota(req, 'GET /api/nfce/consultar');
  if (erro) return erro;

  if (!referencia.includes(perfil!.salao_id)) {
    return NextResponse.json({ erro: 'Não autorizado.' }, { status: 403 });
  }

  const { data: salao } = await supabaseAdmin.from('saloes').select('config_fiscal').eq('id', perfil!.salao_id).maybeSingle();
  const tokenFocus: string | undefined = salao?.config_fiscal?.focus_nfe_token || undefined;

  const resultado = await consultarNFCe(referencia, tokenFocus);

  // Reconcilia o registro local: toda consulta atualiza nfce_emissoes, então
  // uma nota que ficou "processando" (queda de rede na emissão, fila da SEFAZ)
  // é regularizada assim que alguém consulta o status dela.
  const statusInterno =
    resultado.status === 'autorizado' ? 'autorizado' :
    resultado.status === 'processando' ? 'processando' :
    'erro';

  const { error: erroSync } = await supabaseAdmin
    .from('nfce_emissoes')
    .update({
      status: statusInterno,
      chave_acesso: (resultado as any).chave ?? null,
      link_danfe: (resultado as any).link_danfe ?? null,
      link_xml: (resultado as any).link_xml ?? null,
      mensagem_erro: statusInterno === 'erro' ? (resultado.mensagem_erro ?? null) : null,
    })
    .eq('referencia', referencia)
    .eq('salao_id', perfil!.salao_id);

  if (erroSync) {
    // Não bloqueia a resposta — a consulta em si funcionou; só loga a falha de sincronia.
    console.error('[nfce/consultar] Falha ao sincronizar nfce_emissoes:', erroSync.message);
  }

  return NextResponse.json(resultado);
}

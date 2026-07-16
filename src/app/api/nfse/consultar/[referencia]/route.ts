import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { consultarNFSe } from '@/lib/nfse/focusnfe';
import { autenticarRota } from '@/lib/apiAuth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest, { params }: { params: Promise<{ referencia: string }> }) {
  // Next.js 16: params é Promise — precisa de await.
  const { referencia } = await params;
  const { perfil, erro } = await autenticarRota(req, 'GET /api/nfse/consultar');
  if (erro) return erro;

  const { data: salao } = await supabaseAdmin.from('saloes').select('config_fiscal').eq('id', perfil!.salao_id).single();
  const tokenFocus: string | undefined = salao?.config_fiscal?.focus_nfe_token || undefined;

  const resultado = await consultarNFSe(referencia, tokenFocus);

  if (resultado.status === 'autorizado') {
    await supabaseAdmin.from('notas_fiscais').update({
      status: 'Emitida',
      numero_nota: resultado.numero_nota ?? null,
      link_pdf: resultado.link_pdf ?? null,
      link_xml: resultado.link_xml ?? null,
      data_emissao: new Date().toISOString(),
      mensagem_erro: null,
    }).eq('id', referencia).eq('salao_id', perfil!.salao_id);
  }

  return NextResponse.json(resultado);
}

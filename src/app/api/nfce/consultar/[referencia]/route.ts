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
  return NextResponse.json(resultado);
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cancelarNFSe } from '@/lib/nfse/focusnfe';
import { autenticarRota } from '@/lib/apiAuth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ referencia: string }> }) {
  // Next.js 16: params é Promise — precisa de await.
  const { referencia } = await params;
  // Verifica ownership — a nota deve pertencer ao salão do usuário autenticado
  const { perfil, erro } = await autenticarRota(req, 'DELETE /api/nfse/cancelar');
  if (erro) return erro;

  const { data: nota } = await supabaseAdmin.from('notas_fiscais').select('salao_id').eq('id', referencia).maybeSingle();
  if (!nota || nota.salao_id !== perfil!.salao_id) {
    return NextResponse.json({ erro: 'Não autorizado.' }, { status: 403 });
  }

  const { data: salao } = await supabaseAdmin.from('saloes').select('config_fiscal').eq('id', perfil!.salao_id).maybeSingle();
  const tokenFocus: string | undefined = salao?.config_fiscal?.focus_nfe_token || undefined;

  const { justificativa } = await req.json().catch(() => ({ justificativa: 'Cancelamento solicitado pelo cliente.' }));
  const resultado = await cancelarNFSe(referencia, justificativa || 'Cancelamento solicitado pelo cliente.', tokenFocus);

  if (resultado.sucesso) {
    await supabaseAdmin.from('notas_fiscais').update({ status: 'Cancelada' }).eq('id', referencia);
  }

  return NextResponse.json(resultado);
}

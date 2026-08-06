import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { BrasilNFeAdaptador } from '@/lib/nfse';
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
  const tokenNFSe = salao?.config_fiscal?.brasilnfe_company_token || undefined;

  const corpo = await req.json().catch(() => ({}));
  const justificativa = corpo?.justificativa || 'Cancelamento solicitado pelo cliente.';
  // 1 erro na emissão · 2 serviço não prestado · 3 duplicidade · 9 outros.
  // Valor fora da lista cai em 9 ("outros") em vez de mentir "erro na emissão".
  const codigoMotivo = [1, 2, 3, 9].includes(Number(corpo?.codigo_motivo)) ? Number(corpo.codigo_motivo) : 9;
  const resultado = await BrasilNFeAdaptador.cancelar(referencia, justificativa, tokenNFSe, codigoMotivo);

  if (resultado.sucesso) {
    await supabaseAdmin.from('notas_fiscais').update({ status: 'Cancelada' }).eq('id', referencia);
  }

  return NextResponse.json(resultado);
}

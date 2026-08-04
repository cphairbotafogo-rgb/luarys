import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { BrasilNFeAdaptador } from '@/lib/nfse';
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
  const tokenNFSe = salao?.config_fiscal?.brasilnfe_company_token || undefined;

  const resultado = await BrasilNFeAdaptador.consultar(referencia, tokenNFSe);

  if (resultado.status === 'autorizado') {
    await supabaseAdmin.from('notas_fiscais').update({
      status: 'Emitida',
      numero_nota: resultado.numero_nota ?? null,
      storage_path_pdf: resultado.storage_path_pdf ?? null,
      storage_path_xml: resultado.storage_path_xml ?? null,
      data_emissao: new Date().toISOString(),
      mensagem_erro: null,
    }).eq('id', referencia).eq('salao_id', perfil!.salao_id);
  }

  return NextResponse.json(resultado);
}

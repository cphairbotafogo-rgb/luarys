/**
 * GET /api/nfse/codigo-municipal?nac=060101
 *
 * Sugere o código de tributação municipal para o município DO SALÃO que faz a
 * chamada, com base no que a prefeitura de lá já aceitou.
 *
 * Não é tabela oficial e não se apresenta como tal: é o histórico de emissão da
 * plataforma naquele município. Sem histórico, devolve vazio — e a tela pede o
 * código à contabilidade em vez de chutar. Chutar foi o que produziu a rejeição
 * E0314 no salão piloto.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { autenticarRota } from '@/lib/apiAuth';
import { sugerirCodigoMunicipal } from '@/lib/nfse/codigosMunicipais';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const { perfil, erro } = await autenticarRota(req, 'GET /api/nfse/codigo-municipal');
  if (erro) return erro;

  const nac = (req.nextUrl.searchParams.get('nac') || '').replace(/\D/g, '');
  if (!nac) return NextResponse.json({ erro: 'Informe o código nacional (nac).' }, { status: 400 });

  const { data: salao } = await supabaseAdmin
    .from('saloes').select('codigo_ibge, cidade, estado').eq('id', perfil!.salao_id).maybeSingle();

  if (!salao?.codigo_ibge) {
    return NextResponse.json({
      sugestoes: [],
      aviso: 'Código IBGE do município não cadastrado em Dados da Empresa — sem ele não há como buscar o código municipal.',
    });
  }

  const sugestoes = await sugerirCodigoMunicipal(String(salao.codigo_ibge), nac);
  return NextResponse.json({
    municipio: salao.cidade || null,
    codigo_ibge: salao.codigo_ibge,
    sugestoes,
  });
}

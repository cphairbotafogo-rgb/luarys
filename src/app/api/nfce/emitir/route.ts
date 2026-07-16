import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { emitirNFCe, buildPayloadNFCe } from '@/lib/nfce/focusnfe';
import { autenticarRota } from '@/lib/apiAuth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { user, perfil, erro } = await autenticarRota(req, 'POST /api/nfce/emitir');
  if (erro) return erro;

  const body = await req.json();
  const { itens, consumidor, pagamentos, desconto = 0 } = body;

  if (!Array.isArray(itens) || itens.length === 0) {
    return NextResponse.json({ erro: 'Nenhum item informado' }, { status: 400 });
  }

  // Busca dados do salão
  const { data: salao } = await supabaseAdmin
    .from('saloes')
    .select('cnpj, inscricao_estadual, razao_social, nome_fantasia, logradouro, numero, complemento, bairro, cidade, estado, cep, codigo_ibge, telefone, config_fiscal')
    .eq('id', perfil.salao_id)
    .single();

  const tokenFocus: string | undefined = salao?.config_fiscal?.focus_nfe_token || undefined;

  if (!salao?.cnpj) return NextResponse.json({ erro: 'CNPJ não cadastrado. Configure em Dados da Empresa.' }, { status: 422 });
  if (!salao?.codigo_ibge) return NextResponse.json({ erro: 'Código IBGE não cadastrado. Configure em Dados da Empresa.' }, { status: 422 });

  // Busca config NFC-e e incrementa número atomicamente
  const { data: configNfce } = await supabaseAdmin
    .from('configuracoes_nfce_produtos')
    .select('crt, serie, csc_token, csc_id, proximo_numero')
    .eq('salao_id', perfil.salao_id)
    .maybeSingle();

  if (!configNfce?.csc_token) {
    return NextResponse.json({ erro: 'Token CSC não configurado. Configure em NFC-e → Configuração Fiscal.' }, { status: 422 });
  }

  const numero = configNfce.proximo_numero || 1;

  // Incrementa antes de emitir (evita duplicata em caso de falha de rede)
  await supabaseAdmin
    .from('configuracoes_nfce_produtos')
    .update({ proximo_numero: numero + 1 })
    .eq('salao_id', perfil.salao_id);

  const referencia = `nfce-${perfil.salao_id}-${numero}`;

  const payload = buildPayloadNFCe({
    numero,
    salao,
    config: configNfce,
    itens,
    consumidor,
    pagamentos,
    desconto,
  });

  const resultado = await emitirNFCe(referencia, payload, tokenFocus);

  return NextResponse.json({ ...resultado, referencia, numero });
}

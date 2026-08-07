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

  // A nota tem que ser deste salão ANTES de qualquer chamada ao provedor. Sem
  // isto, bastava passar o id de uma nota de outro salão na URL: a consulta ia
  // ao provedor com o CodLote alheio e o resultado voltava inteiro na resposta.
  // O cancelar já conferia; esta rota não. Mesma resposta para "não existe" e
  // "não é sua" — dizer qual dos dois confirmaria a existência do id.
  const { data: dona } = await supabaseAdmin
    .from('notas_fiscais').select('salao_id').eq('id', referencia).maybeSingle();
  if (!dona || dona.salao_id !== perfil!.salao_id) {
    return NextResponse.json({ erro: 'Nota não encontrada.' }, { status: 404 });
  }

  const { data: salao } = await supabaseAdmin.from('saloes').select('config_fiscal').eq('id', perfil!.salao_id).single();
  const tokenNFSe = salao?.config_fiscal?.brasilnfe_company_token || undefined;

  const resultado = await BrasilNFeAdaptador.consultar(referencia, tokenNFSe);

  if (resultado.status === 'autorizado') {
    await supabaseAdmin.from('notas_fiscais').update({
      status: 'Emitida',
      numero_nota: resultado.numero_nota ?? null,
      storage_path_pdf: resultado.storage_path_pdf ?? null,
      storage_path_xml: resultado.storage_path_xml ?? null,
      // dhProc do XML — a nota confirmada aqui foi autorizada antes, e pode ter
      // sido em outro mês. Gravar a hora da consulta joga a competência para a
      // frente.
      data_emissao: resultado.data_autorizacao ?? new Date().toISOString(),
      mensagem_erro: null,
      // Mesma gravação da rota de emissão: a nota que só se confirma aqui (lote
      // que ficou em processamento) precisa guardar a chave igual às outras.
      chave_acesso: resultado.chave_acesso ?? null,
      rps_numero: resultado.rps_numero ?? null,
      protocolo_sefaz: resultado.protocolo_sefaz ?? null,
      codigo_verificacao: resultado.codigo_verificacao ?? null,
      base_calculo: resultado.base_calculo ?? null,
      valor_iss: resultado.valor_iss ?? null,
      aliquota_apurada: resultado.aliquota_apurada ?? null,
    }).eq('id', referencia).eq('salao_id', perfil!.salao_id);
  }

  // Nota pendente que a consulta provou não existir na Brasil NFe volta para
  // 'Não Emitido', para poder ser reemitida.
  //
  // Sem isto ela ficaria pendente para sempre: a emissão só aceita 'Não Emitido'
  // e 'Erro'. É a outra metade da proteção contra duplicidade — o `catch` da
  // emissão manda a dúvida para cá, e é aqui que a dúvida vira resposta.
  if (resultado.status === 'erro' && /não chegou|não há nota/i.test(resultado.mensagem_erro ?? '')) {
    await supabaseAdmin.from('notas_fiscais').update({
      status: 'Não Emitido',
      mensagem_erro: resultado.mensagem_erro,
    }).eq('id', referencia).eq('salao_id', perfil!.salao_id).eq('status', 'Pendente');
  }

  return NextResponse.json(resultado);
}

// src/app/api/nfce/reconciliar/route.ts
//
// Reconciliação das NFC-e pendentes: busca as notas do salão que ficaram com
// status "processando" em nfce_emissoes (fila da SEFAZ, queda de rede logo
// após a emissão etc.), consulta cada uma na Focus NFe e atualiza o registro
// local. Chamada pelo botão "Atualizar pendentes" da aba Histórico de Cupons.
//
// Idempotente por natureza: reconsultar uma nota já resolvida apenas regrava
// o mesmo status. Limite de 20 por chamada para não estourar o tempo da
// função serverless — se houver mais, o retorno indica quantas restam.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { BrasilNFeAdaptadorNFCe } from '@/lib/nfce/brasilnfe';
import { autenticarRota } from '@/lib/apiAuth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const LIMITE_POR_CHAMADA = 20;

export async function POST(req: NextRequest) {
  const { perfil, erro } = await autenticarRota(req, 'POST /api/nfce/reconciliar');
  if (erro) return erro;

  const { data: salao } = await supabaseAdmin
    .from('saloes')
    .select('config_fiscal')
    .eq('id', perfil!.salao_id)
    .maybeSingle();
  const tokenNFCe = salao?.config_fiscal?.brasilnfe_company_token || undefined;

  // Só reconcilia notas com mais de 2 minutos — as recém-emitidas ainda podem
  // estar na fila normal da SEFAZ e serão resolvidas pelo próprio fluxo de emissão.
  const corte = new Date(Date.now() - 2 * 60 * 1000).toISOString();

  const { data: pendentes, error: erroBusca } = await supabaseAdmin
    .from('nfce_emissoes')
    .select('referencia')
    .eq('salao_id', perfil!.salao_id)
    .eq('status', 'processando')
    .lt('criado_em', corte)
    .order('criado_em', { ascending: true })
    .limit(LIMITE_POR_CHAMADA + 1);

  if (erroBusca) {
    console.error('[nfce/reconciliar] Falha ao buscar pendentes:', erroBusca.message);
    return NextResponse.json({ erro: 'Não foi possível buscar as notas pendentes.' }, { status: 500 });
  }

  const fila = (pendentes || []).slice(0, LIMITE_POR_CHAMADA);
  const restam = (pendentes || []).length > LIMITE_POR_CHAMADA;

  let autorizadas = 0;
  let comErro = 0;
  let aindaProcessando = 0;

  for (const nota of fila) {
    try {
      const resultado = await BrasilNFeAdaptadorNFCe.consultar(nota.referencia, tokenNFCe);

      const statusInterno =
        resultado.status === 'autorizado' ? 'autorizado' :
        resultado.status === 'processando' ? 'processando' :
        'erro';

      if (statusInterno === 'autorizado') autorizadas++;
      else if (statusInterno === 'erro') comErro++;
      else aindaProcessando++;

      const { error: erroUpdate } = await supabaseAdmin
        .from('nfce_emissoes')
        .update({
          status: statusInterno,
          chave_acesso: resultado.chave ?? null,
          storage_path_danfe: resultado.storage_path_danfe ?? null,
          storage_path_xml: resultado.storage_path_xml ?? null,
          mensagem_erro: statusInterno === 'erro' ? (resultado.mensagem_erro ?? null) : null,
        })
        .eq('referencia', nota.referencia)
        .eq('salao_id', perfil!.salao_id);

      if (erroUpdate) {
        console.error('[nfce/reconciliar] Falha ao atualizar', nota.referencia, erroUpdate.message);
      }
    } catch (e) {
      // Uma nota com falha de rede não derruba o lote — segue para a próxima.
      console.error('[nfce/reconciliar] Falha ao consultar', nota.referencia, e);
      aindaProcessando++;
    }
  }

  return NextResponse.json({
    verificadas: fila.length,
    autorizadas,
    com_erro: comErro,
    ainda_processando: aindaProcessando,
    restam_pendentes: restam,
  });
}

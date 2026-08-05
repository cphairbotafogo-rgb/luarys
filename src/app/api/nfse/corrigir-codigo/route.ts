/**
 * PATCH /api/nfse/corrigir-codigo
 *
 * Corrige o código fiscal de notas ainda não emitidas, direto da tela de
 * emissão.
 *
 * Por que existe: quando a prefeitura recusa por código, o caminho era sair
 * para Serviços → Edição Rápida Fiscal, corrigir lá e esperar a próxima venda —
 * o que não resolve as notas que já existem. Pior no caso de serviço excluído
 * do catálogo: não há mais o que editar, e a nota ficava presa para sempre.
 *
 * Escreve via service_role, como todas as demais rotas de nota: o client nunca
 * atualiza notas_fiscais diretamente.
 *
 * Body: { nota_ids: string[], item_lista_servico?: string, codigo_tributacao_municipio?: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { autenticarRota } from '@/lib/apiAuth';
import { lc116Valido } from '@/lib/nfse/lc116';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function PATCH(req: NextRequest) {
  const { perfil, erro } = await autenticarRota(req, 'PATCH /api/nfse/corrigir-codigo');
  if (erro) return erro;

  const body = await req.json().catch(() => ({}));
  const notaIds: string[] = Array.isArray(body?.nota_ids) ? body.nota_ids : [];
  const cTribNac = String(body?.item_lista_servico ?? '').trim();
  const cTribMun = String(body?.codigo_tributacao_municipio ?? '').trim();

  if (notaIds.length === 0) {
    return NextResponse.json({ erro: 'Selecione ao menos uma nota.' }, { status: 400 });
  }
  if (!cTribNac && !cTribMun) {
    return NextResponse.json({ erro: 'Informe o código a corrigir.' }, { status: 400 });
  }
  // Validar aqui evita gravar um código que a prefeitura recusaria depois — o
  // ponto desta rota é justamente tirar a nota do estado de recusa.
  if (cTribNac && !lc116Valido(cTribNac)) {
    return NextResponse.json(
      { erro: `"${cTribNac}" não é um código de tributação nacional válido. São 6 dígitos, sem ponto (ex: 060101).` },
      { status: 422 },
    );
  }
  if (cTribMun && !/^\d{1,6}$/.test(cTribMun)) {
    return NextResponse.json(
      { erro: `"${cTribMun}" não é um código municipal válido. Use apenas dígitos (ex: 005).` },
      { status: 422 },
    );
  }

  const alteracao: Record<string, string> = {};
  if (cTribNac) alteracao.item_lista_servico = cTribNac;
  if (cTribMun) alteracao.codigo_tributacao_municipio = cTribMun;

  // Só nota que ainda não virou documento fiscal. O filtro de salão vem junto
  // no update (e não numa checagem separada) para que nao haja janela entre
  // conferir e gravar.
  const { data, error } = await supabaseAdmin
    .from('notas_fiscais')
    .update(alteracao)
    .in('id', notaIds)
    .eq('salao_id', perfil.salao_id)
    .in('status', ['Não Emitido', 'Erro'])
    .select('id');

  if (error) {
    console.error('[nfse/corrigir-codigo] falha ao atualizar:', error.message);
    return NextResponse.json({ erro: 'Não foi possível corrigir: ' + error.message }, { status: 500 });
  }

  const atualizadas = data?.length ?? 0;
  const ignoradas = notaIds.length - atualizadas;

  return NextResponse.json({
    ok: true,
    atualizadas,
    ignoradas,
    // Nota já emitida é documento fiscal transmitido: reescrever o código aqui
    // divergiria do XML autorizado, por isso fica de fora.
    aviso: ignoradas > 0
      ? `${ignoradas} nota(s) não foram alteradas por já terem sido emitidas.`
      : undefined,
  });
}

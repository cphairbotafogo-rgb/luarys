/**
 * POST /api/admin/modulos/alternar
 *
 * Ativa/desativa um módulo de um salão pelo admin da plataforma
 * (LiberarModulosPorSalao, ModalModulosSalao). Ao desativar, cancela
 * também a subscription recorrente no Asaas se houver uma ativa —
 * antes essas telas só desligavam `salao_modulos.ativo` localmente,
 * deixando a cobrança automática rodando mesmo com o módulo "desligado".
 *
 * Se a cobrança já tiver sido gerada e o cancelamento no Asaas falhar,
 * a rota retorna erro e NÃO desativa o módulo localmente — melhor manter
 * o acesso e a cobrança consistentes do que cortar acesso de quem
 * continuaria sendo cobrado.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cancelarAssinaturaAsaas } from '@/lib/assinaturas';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    return await handlePost(req);
  } catch (e: any) {
    return NextResponse.json({ erro: 'Erro inesperado: ' + (e?.message || String(e)) }, { status: 500 });
  }
}

async function handlePost(req: NextRequest) {
  const authHeader = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!authHeader) return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 });

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(authHeader);
  if (authErr || !user) return NextResponse.json({ erro: 'Sessão inválida' }, { status: 401 });

  const { data: perfil } = await supabaseAdmin
    .from('perfis_usuarios')
    .select('is_plataforma_admin')
    .eq('id', user.id)
    .maybeSingle();

  if (!perfil?.is_plataforma_admin) {
    return NextResponse.json({ erro: 'Acesso restrito a administradores da plataforma.' }, { status: 403 });
  }

  const { salao_id, modulo_chave, ativo } = await req.json().catch(() => ({}));
  if (!salao_id || !modulo_chave || typeof ativo !== 'boolean') {
    return NextResponse.json({ erro: 'salao_id, modulo_chave e ativo (boolean) são obrigatórios.' }, { status: 400 });
  }

  // ── Desativando: cancela a cobrança recorrente no Asaas antes de tocar no módulo ──
  if (!ativo) {
    const resultado = await cancelarAssinaturaAsaas(salao_id, modulo_chave);
    if (resultado.erro) {
      return NextResponse.json({ erro: `Módulo não foi desativado — falha ao cancelar a cobrança no Asaas: ${resultado.erro}` }, { status: 400 });
    }
  }

  const payload: Record<string, any> = {
    salao_id,
    modulo_chave,
    ativo,
    origem: 'admin',
    cancelamento_agendado: false,
  };
  if (ativo) {
    payload.ativado_em = new Date().toISOString();
    payload.renovacao_em = null; // liberação manual pelo admin: sem prazo definido
  }

  const { error } = await supabaseAdmin
    .from('salao_modulos')
    .upsert(payload, { onConflict: 'salao_id,modulo_chave' });

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  return NextResponse.json({ sucesso: true });
}

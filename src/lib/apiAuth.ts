/**
 * src/lib/apiAuth.ts
 *
 * Middleware compartilhado de autenticação para as rotas de API do Luarys.
 *
 * Uso em cada rota:
 *   import { autenticarRota } from '@/lib/apiAuth';
 *
 *   export async function POST(req: NextRequest) {
 *     const { user, perfil, erro } = await autenticarRota(req, 'POST /api/minha-rota');
 *     if (erro) return erro;   // NextResponse 401/403 pronto para retornar
 *     // ... lógica de negócio usando user.id e perfil.salao_id
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Cliente admin compartilhado — ignora RLS, só para verificação de identidade
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export interface PerfilRota {
  salao_id: string;
  role?: string | null;
}

// Union discriminada por `erro`: quando `erro` é null (sucesso), `perfil` é
// garantidamente não-nulo — então `if (erro) return erro;` já estreita o tipo e
// o uso de `perfil.salao_id` na sequência não acusa "possibly null". Sem isto,
// cada rota precisaria de `perfil!` ou de um guard extra.
export type ResultadoAuth =
  | { user: { id: string; email?: string }; perfil: PerfilRota; erro: null }
  | { user: { id: string; email?: string } | null; perfil: null; erro: NextResponse };

/**
 * Autentica a requisição e resolve o perfil do usuário.
 *
 * Etapas:
 *  1. Extrai Bearer token do header Authorization.
 *  2. Valida sessão via supabaseAdmin.auth.getUser().
 *  3. Busca perfil_usuario (salao_id, role) na tabela perfis_usuarios.
 *  4. Grava log estruturado no console com latência e resultado.
 *
 * @param req       NextRequest recebido na rota.
 * @param rotaLabel Identificador da rota para o log, ex: 'POST /api/nfse/emitir'.
 */
export async function autenticarRota(
  req: NextRequest | Request,
  rotaLabel?: string
): Promise<ResultadoAuth> {
  const inicio = Date.now();
  const metodo = req.method ?? 'UNKNOWN';
  const label = rotaLabel ?? metodo;

  // 1. Extrai token
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    const latencia = Date.now() - inicio;
    console.log(`[API] ${label} user=anon salao=- status=401 latencia=${latencia}ms motivo=token_ausente`);
    return {
      user: null,
      perfil: null,
      erro: NextResponse.json({ erro: 'Sessão ausente. Faça login novamente.' }, { status: 401 }),
    };
  }

  // 2. Valida sessão
  const { data: { user }, error: erroAuth } = await supabaseAdmin.auth.getUser(token);

  if (erroAuth || !user) {
    const latencia = Date.now() - inicio;
    console.log(`[API] ${label} user=invalido salao=- status=401 latencia=${latencia}ms motivo=sessao_invalida`);
    return {
      user: null,
      perfil: null,
      erro: NextResponse.json({ erro: 'Sessão inválida ou expirada. Faça login novamente.' }, { status: 401 }),
    };
  }

  // 3. Resolve perfil (salao_id, role)
  const { data: perfil } = await supabaseAdmin
    .from('perfis_usuarios')
    .select('salao_id, role')
    .eq('id', user.id)
    .maybeSingle();

  if (!perfil?.salao_id) {
    const latencia = Date.now() - inicio;
    console.log(`[API] ${label} user=${user.id} salao=- status=403 latencia=${latencia}ms motivo=perfil_sem_salao`);
    return {
      user,
      perfil: null,
      erro: NextResponse.json({ erro: 'Perfil sem salão associado.' }, { status: 403 }),
    };
  }

  // 4. Sucesso — loga e devolve
  const latencia = Date.now() - inicio;
  console.log(`[API] ${label} user=${user.id} salao=${perfil.salao_id} status=ok latencia=${latencia}ms`);

  return { user, perfil, erro: null };
}

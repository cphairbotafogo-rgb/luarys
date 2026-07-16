import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  try {
    // Sessão obrigatória — impede falsificação de aceite por terceiros
    const bearerToken = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!bearerToken) {
      return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 });
    }

    const { data: { user } } = await supabaseAdmin.auth.getUser(bearerToken);
    if (!user) {
      return NextResponse.json({ erro: 'Sessão inválida.' }, { status: 401 });
    }

    const { salao_id, usuario_id, documento_id, versao_aceita, concordou_dpa } = await request.json();

    if (!salao_id || !usuario_id || !documento_id || !versao_aceita) {
      return NextResponse.json({ erro: 'Campos obrigatórios ausentes.' }, { status: 400 });
    }

    if (!UUID_REGEX.test(salao_id) || !UUID_REGEX.test(usuario_id)) {
      return NextResponse.json({ erro: 'ID inválido.' }, { status: 400 });
    }

    // usuario_id deve ser o próprio usuário autenticado — sem exceção
    if (usuario_id !== user.id) {
      return NextResponse.json({ erro: 'Não autorizado.' }, { status: 403 });
    }

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      null;

    const { error } = await supabaseAdmin.from('aceites_contrato').insert({
      salao_id,
      usuario_id,
      documento_id,
      versao_aceita,
      ip_aceite: ip,
    });

    if (error) {
      return NextResponse.json({ erro: 'Erro ao registrar aceite: ' + error.message }, { status: 500 });
    }

    // Registra aceite do DPA/CTD no config_fiscal do salão (LGPD art. 7, V)
    if (concordou_dpa) {
      const { data: salao } = await supabaseAdmin
        .from('saloes')
        .select('config_fiscal')
        .eq('id', salao_id)
        .maybeSingle();

      const novaConfig = {
        ...(salao?.config_fiscal || {}),
        dpa_aceito_em: new Date().toISOString(),
        dpa_versao: 1,
      };

      await supabaseAdmin.from('saloes').update({ config_fiscal: novaConfig }).eq('id', salao_id);
    }

    return NextResponse.json({ registrado: true });
  } catch {
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 });
  }
}

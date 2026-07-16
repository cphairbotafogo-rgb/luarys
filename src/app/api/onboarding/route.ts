/**
 * src/app/api/onboarding/route.ts
 *
 * Cria um novo salão no sistema Luarys em 3 passos atômicos:
 *   1. Cria o usuário no Supabase Auth
 *   2. Cria o registro na tabela `saloes`
 *   3. Cria o perfil do dono em `perfis_usuarios` vinculado ao salão
 *
 * Se qualquer passo falhar, reverte os anteriores (rollback manual).
 * Usa SUPABASE_SERVICE_ROLE_KEY — roda apenas no servidor (Next.js Route Handler).
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimitExcedido, obterIp } from '@/lib/rateLimiter';

// ─── VALIDAÇÕES ───────────────────────────────────────────────────────────────
function validarEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validarSlug(slug: string) {
  return /^[a-z0-9-]{3,40}$/.test(slug);
}

function slugify(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // remove acentos
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 40);
}

// ─── AMBIENTE DE DEMONSTRAÇÃO ───────────────────────────────────────────────
// Popula o salão recém-criado com serviços, profissionais e agendamentos de
// exemplo, para o dono já ver o sistema "vivo" no primeiro acesso (Aha! Moment).
// Falhas aqui NÃO devem impedir a criação da conta — por isso tudo é best-effort.
async function popularAmbienteDemo(admin: any, salaoId: string) {
  try {
    const { data: servicosDemo } = await admin
      .from('servicos')
      .insert([
        { salao_id: salaoId, nome_servico: 'Corte Feminino', preco_padrao: 80, duracao_minutos: 60, is_demo: true },
        { salao_id: salaoId, nome_servico: 'Corte Masculino', preco_padrao: 50, duracao_minutos: 30, is_demo: true },
        { salao_id: salaoId, nome_servico: 'Escova', preco_padrao: 60, duracao_minutos: 45, is_demo: true },
        { salao_id: salaoId, nome_servico: 'Coloração', preco_padrao: 150, duracao_minutos: 120, is_demo: true },
        { salao_id: salaoId, nome_servico: 'Manicure', preco_padrao: 35, duracao_minutos: 40, is_demo: true },
      ])
      .select('id, nome_servico');

    // Comissão de 40% em cada serviço demo, no formato que a Aba Equipe / Fechamento de Caixa esperam
    const servicosComissoesDemo: Record<string, number> = {};
    (servicosDemo || []).forEach((s: any) => { servicosComissoesDemo[s.id] = 40; });

    const { data: profissionaisDemo } = await admin
      .from('profissionais')
      .insert([
        { salao_id: salaoId, nome: 'Ana Souza (exemplo)', ativo: true, produtivo: true, servicos_comissoes: servicosComissoesDemo, comissao_produtos: 10, permite_comissao_produtos: true, perfil_avancado: { exibir_na_agenda: true }, is_demo: true },
        { salao_id: salaoId, nome: 'Marcos Lima (exemplo)', ativo: true, produtivo: true, servicos_comissoes: servicosComissoesDemo, comissao_produtos: 10, permite_comissao_produtos: true, perfil_avancado: { exibir_na_agenda: true }, is_demo: true },
      ])
      .select('id, nome');

    if (servicosDemo?.length >= 3 && profissionaisDemo?.length >= 2) {
      const hoje = new Date().toISOString().split('T')[0];
      const slots = [
        { hora: '09:00', dur: 60 },
        { hora: '10:30', dur: 30 },
        { hora: '14:00', dur: 45 },
      ];
      const clientesDemo = ['Maria (exemplo)', 'João (exemplo)', 'Carla (exemplo)'];

      const agendamentosDemo = slots.map((slot, idx) => ({
        salao_id: salaoId,
        profissional_id: profissionaisDemo[idx % profissionaisDemo.length].id,
        servico_id: servicosDemo[idx].id,
        cliente_nome: clientesDemo[idx],
        data: hoje,
        inicio: slot.hora,
        duracao_minutos: slot.dur,
        data_hora_inicio: new Date(`${hoje}T${slot.hora}:00`).toISOString(),
        status: 'Confirmado',
        cor: '#7BAED8',
        is_demo: true,
      }));

      await admin.from('agendamentos').insert(agendamentosDemo);
    }

    await admin.from('saloes').update({ ambiente_demo: true }).eq('id', salaoId);
  } catch (e: any) {
    console.error('Erro ao popular ambiente demo (não-crítico):', e?.message || e);
  }
}

// ─── HANDLER ──────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  // 3 cadastros por IP a cada hora — evita criação de contas em massa
  if (rateLimitExcedido(obterIp(request), 3, 3600)) {
    return NextResponse.json({ erro: 'Muitos cadastros em sequência. Aguarde alguns minutos e tente novamente.' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const { email, senha, nomeSalao, telefone, cidade, estado, slug,
            cnpj, razaoSocial, responsavelNome, responsavelCpf } = body;

    // Validações básicas
    if (!email || !senha || !nomeSalao || !slug) {
      return NextResponse.json({ erro: 'Campos obrigatórios faltando.' }, { status: 400 });
    }

    if (!responsavelNome?.trim()) {
      return NextResponse.json({ erro: 'Nome do responsável é obrigatório.' }, { status: 400 });
    }

    if (!cnpj || cnpj.replace(/[.\-\/\s]/g, '').length !== 14) {
      return NextResponse.json({ erro: 'CNPJ inválido.' }, { status: 400 });
    }

    if (!razaoSocial?.trim()) {
      return NextResponse.json({ erro: 'Razão Social é obrigatória.' }, { status: 400 });
    }

    if (!validarEmail(email)) {
      return NextResponse.json({ erro: 'E-mail inválido.' }, { status: 400 });
    }

    if (senha.length < 6) {
      return NextResponse.json({ erro: 'A senha deve ter pelo menos 6 caracteres.' }, { status: 400 });
    }

    const slugFinal = slugify(slug || nomeSalao);

    if (!validarSlug(slugFinal)) {
      return NextResponse.json({ erro: 'Link do salão inválido. Use apenas letras minúsculas, números e hífens.' }, { status: 400 });
    }

    // Cliente admin (service role)
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // ── PASSO 1: Verificar se slug já existe ──────────────────────────────────
    const { data: slugExistente } = await admin
      .from('saloes')
      .select('id')
      .eq('slug', slugFinal)
      .maybeSingle();

    if (slugExistente) {
      return NextResponse.json({ erro: 'Este link já está em uso. Escolha outro nome para o link do seu salão.' }, { status: 409 });
    }

    // ── PASSO 1.5: Verificar se CNPJ já está cadastrado ───────────────────────
    const cnpjNumeros = cnpj.replace(/[.\-\/\s]/g, '').toUpperCase();
    const { data: cnpjExistente } = await admin
      .from('saloes')
      .select('id')
      .eq('cnpj', cnpjNumeros)
      .maybeSingle();

    if (cnpjExistente) {
      return NextResponse.json({ erro: 'Este CNPJ já possui uma conta cadastrada. Entre em contato com o suporte se precisar de ajuda.' }, { status: 409 });
    }

    // ── PASSO 2: Criar usuário no Auth ────────────────────────────────────────
    const { data: authData, error: authErro } = await admin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
    });

    if (authErro || !authData?.user) {
      const msg = authErro?.message || '';
      if (msg.includes('already registered') || msg.includes('already been registered')) {
        return NextResponse.json({ erro: 'Este e-mail já possui uma conta. Faça login.' }, { status: 409 });
      }
      return NextResponse.json({ erro: 'Erro ao criar conta: ' + msg }, { status: 400 });
    }

    const userId = authData.user.id;

    // ── PASSO 3: Criar salão ──────────────────────────────────────────────────
    // Trial de 14 dias a partir do momento do cadastro
    const trialExpiracao = new Date();
    trialExpiracao.setDate(trialExpiracao.getDate() + 14);

    const { data: salaoData, error: salaoErro } = await admin
      .from('saloes')
      .insert([{
        nome_fantasia:     nomeSalao.trim(),
        slug:              slugFinal,
        telefone:          telefone?.trim() || null,
        cidade:            cidade?.trim() || null,
        estado:            estado?.trim() || null,
        email_contato:     email,
        cnpj:              cnpj?.replace(/[.\-\/\s]/g, '').toUpperCase() || null,
        razao_social:      razaoSocial?.trim() || null,
        responsavel_nome:  responsavelNome?.trim() || null,
        responsavel_cpf:   responsavelCpf?.replace(/\D/g, '') || null,
        trial_expiracao:   trialExpiracao.toISOString(),
      }])
      .select('id')
      .single();

    if (salaoErro || !salaoData) {
      // Rollback: apagar o usuário criado
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json({ erro: 'Erro ao criar salão: ' + salaoErro?.message }, { status: 400 });
    }

    const salaoId = salaoData.id;

    // ── PASSO 4: Criar perfil do dono ─────────────────────────────────────────
    const { error: perfilErro } = await admin
      .from('perfis_usuarios')
      .insert([{
        id: userId,
        nome: responsavelNome.trim(),
        salao_id: salaoId,
      }]);

    if (perfilErro) {
      // Rollback: apagar salão e usuário
      await admin.from('saloes').delete().eq('id', salaoId);
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json({ erro: 'Erro ao criar perfil: ' + perfilErro.message }, { status: 400 });
    }

    // ── PASSO 5: Popular ambiente com dados de demonstração (best-effort) ────
    await popularAmbienteDemo(admin, salaoId);

    return NextResponse.json({
      sucesso: true,
      salaoId,
      slug: slugFinal,
      mensagem: 'Conta criada com sucesso!',
    });

  } catch (err: any) {
    return NextResponse.json({ erro: 'Erro interno: ' + err.message }, { status: 500 });
  }
}
import { supabase } from "@/lib/supabase";
import { derivarAcessoPlano } from "@/lib/planos";

// ─── Helpers internos ─────────────────────────────────────────────────────────

function extrairDadosSalao(saloesRel: any): any {
  if (!saloesRel) return null;
  return Array.isArray(saloesRel) ? saloesRel[0] : saloesRel;
}

/**
 * Módulos sem preço (preco_mensal nulo ou <= 0) não têm checkout — regra de
 * negócio é que ficam liberados automaticamente, sem depender de uma linha
 * em salao_modulos (nunca é criada pra eles, já que não há pagamento).
 */
async function buscarChavesGratis(): Promise<string[]> {
  const { data } = await supabase
    .from('modulos_catalogo')
    .select('chave, preco_mensal')
    .eq('ativo', true);
  return (data || [])
    .filter((m: any) => m.preco_mensal == null || Number(m.preco_mensal) <= 0)
    .map((m: any) => m.chave);
}

function derivarModulos(
  modulosAtivos: string[],
  statusAssinatura: string | null,
  legacyFiscal: boolean,
  legacyComm: boolean,
  acessoTotal: boolean,
) {
  const todosLiberados = {
    moduloFiscalLiberado: true, moduloComunicacaoLiberado: true,
    moduloCrescimentoLiberado: true, moduloPrecificacaoLiberado: true,
    moduloFidelidadeLiberado: true, moduloRelatoriosLiberado: true,
    moduloEstoqueLiberado: true, moduloFinanceiroLiberado: true,
  };
  if (acessoTotal || (statusAssinatura ?? 'trial') === 'trial') return todosLiberados;
  const tem = (chave: string) => modulosAtivos.includes(chave);
  // "fiscal" e "comunicacao" são chaves antigas/inativas em modulos_catalogo
  // (ativo=false) — quem é vendido de verdade é "nfse"/"nfce" e
  // "central_comunicacao". Checar só a chave antiga fazia o módulo pago nunca
  // liberar, mesmo com o pagamento confirmado e salao_modulos.ativo=true.
  return {
    moduloFiscalLiberado:        tem('fiscal') || tem('nfse') || tem('nfce') || legacyFiscal,
    moduloComunicacaoLiberado:   tem('comunicacao') || tem('central_comunicacao') || legacyComm,
    moduloCrescimentoLiberado:   tem('crescimento'),
    moduloPrecificacaoLiberado:  tem('precificacao'),
    moduloFidelidadeLiberado:    tem('fidelidade'),
    moduloRelatoriosLiberado:    tem('relatorios'),
    moduloEstoqueLiberado:       tem('estoque'),
    moduloFinanceiroLiberado:    tem('financeiro'),
  };
}

// ─── Tipos de resultado ──────────────────────────────────────────────────────

export type ResultadoLogin =
  | { tipo: 'dono'; perfil: any }
  | { tipo: 'funcionario'; perfil: any }
  | { tipo: 'sem_acesso'; motivo: string }
  | { tipo: 'nao_encontrado' };

// ─── Função principal ─────────────────────────────────────────────────────────

export async function carregarPerfilUsuario(userId: string): Promise<ResultadoLogin> {
  // 1. Tenta tabela de donos (perfis_usuarios)
  // Queries separadas em vez de JOIN com saloes(*) porque a RLS pode bloquear
  // o JOIN silenciosamente — o erro seria ignorado e o dono tratado como funcionário.
  const { data: dono, error: erroDono } = await supabase
    .from('perfis_usuarios').select('*').eq('id', userId).single();

  if (dono) {
    const [{ data: salaoData }, { data: salaoModulosData }, chavesGratis] = await Promise.all([
      supabase.from('saloes').select('*').eq('id', dono.salao_id).single(),
      supabase.from('salao_modulos').select('modulo_chave').eq('salao_id', dono.salao_id).eq('ativo', true),
      buscarChavesGratis(),
    ]);

    const acessoTotal  = !!salaoData?.acesso_total;
    const modulosAtivos = [...(salaoModulosData || []).map((m: any) => m.modulo_chave), ...chavesGratis];
    const acesso   = derivarAcessoPlano(salaoData?.plano_assinatura, salaoData?.status_assinatura, acessoTotal, salaoData?.trial_expiracao);
    const modulos  = derivarModulos(modulosAtivos, salaoData?.status_assinatura, !!salaoData?.modulo_fiscal_liberado, !!salaoData?.api_whatsapp_liberada, acessoTotal);

    return {
      tipo: 'dono',
      perfil: {
        ...dono,
        salao_id: dono.salao_id,
        isDono: true,
        ...modulos,
        planoBloqueado:  acesso.planoBloqueado,
        planoNome:       acesso.planoNome,
        ambienteDemo:    !!salaoData?.ambiente_demo,
        trial_expiracao: salaoData?.trial_expiracao ?? null,
        plano_chave:     salaoData?.plano_assinatura ?? salaoData?.plano_chave ?? null,
        acesso_total:    acessoTotal,
        permissoes: {
          acesso_sistema: true, ver_dashboard: true, ver_financeiro: true, fazer_estorno: true,
          aplicar_desconto: true, editar_equipe: true, ver_propria_agenda: true,
          criar_proprio_agendamento: true, editar_valores_proprio_agendamento: true,
          ver_proprio_faturamento: true, bloquear_proprio_horario: true
        }
      }
    };
  }

  // PGRST116 = "not found" — esperado para funcionários
  if (erroDono && erroDono.code !== 'PGRST116') {
    console.warn('[Luarys Auth] Erro ao buscar perfis_usuarios:', erroDono.message, erroDono.code);
  }

  // 2. Tenta tabela de funcionários (profissionais)
  const { data: funcionario, error: erroFunc } = await supabase
    .from('profissionais').select('*, saloes:salao_id(*)').eq('id', userId).single();

  if (erroFunc && erroFunc.code !== 'PGRST116') {
    console.warn('[Luarys Auth] Erro ao buscar profissional (possível RLS):', erroFunc.message, erroFunc.code);
  }
  if (!funcionario) return { tipo: 'nao_encontrado' };

  if (!funcionario.permissoes || !funcionario.permissoes.acesso_sistema) {
    return { tipo: 'sem_acesso', motivo: 'O seu acesso ao sistema foi desativado pelo administrador.' };
  }

  const dadosSalao      = extrairDadosSalao(funcionario.saloes);
  const acessoTotalFunc = !!dadosSalao?.acesso_total;
  const [{ data: modulosFunc }, chavesGratisFunc] = await Promise.all([
    supabase.from('salao_modulos').select('modulo_chave').eq('salao_id', funcionario.salao_id).eq('ativo', true),
    buscarChavesGratis(),
  ]);
  const modulosAtivosFunc = [...(modulosFunc || []).map((m: any) => m.modulo_chave), ...chavesGratisFunc];
  const acessoFunc  = derivarAcessoPlano(dadosSalao?.plano_assinatura, dadosSalao?.status_assinatura, acessoTotalFunc, dadosSalao?.trial_expiracao);
  const modulosFunc2 = derivarModulos(modulosAtivosFunc, dadosSalao?.status_assinatura, !!dadosSalao?.modulo_fiscal_liberado, !!dadosSalao?.api_whatsapp_liberada, acessoTotalFunc);

  return {
    tipo: 'funcionario',
    perfil: {
      ...funcionario,
      isDono: false,
      ...modulosFunc2,
      planoBloqueado: acessoFunc.planoBloqueado,
      planoNome:      acessoFunc.planoNome,
      acesso_total:   acessoTotalFunc,
    }
  };
}

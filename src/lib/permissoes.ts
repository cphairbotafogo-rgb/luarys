/**
 * src/lib/permissoes.ts
 *
 * Catálogo central de permissões granulares do Luarys. Cada permissão é uma
 * chave única, organizada em categorias (igual ao painel de referência da
 * Trinks que orientou esse desenho). Vive como constante no código — não
 * no banco — porque é estável e não precisa de query para ser lida.
 *
 * IMPORTANTE: já existem chaves "antigas" salvas em profissionais.permissoes
 * (ex: fazer_estorno, aplicar_desconto) de uma versão anterior, mais simples,
 * do sistema de permissões. Elas continuam funcionando exatamente como
 * estão — nunca foram removidas ou renomeadas. O EQUIVALENCIA_ANTIGA abaixo
 * mapeia a chave nova para a antiga correspondente, para que o dono que já
 * configurou um colaborador antes não perca nada ao migrarmos a UI para o
 * catálogo novo.
 */

export type CategoriaPermissao =
  | 'agenda'
  | 'caixa'
  | 'comissoes'
  | 'dados'
  | 'fiscal'
  | 'modulo'
  | 'auditoria';

export interface DefinicaoPermissao {
  chave: string;
  categoria: CategoriaPermissao;
  rotulo: string;
  descricao: string;
  /** nível crítico: ações que devem gerar log de auditoria quando executadas */
  critica?: boolean;
}

export const CATALOGO_PERMISSOES: DefinicaoPermissao[] = [
  // ── AGENDA ──────────────────────────────────────────────────────────────
  { chave: 'agenda.criar_agendamento', categoria: 'agenda', rotulo: 'Criar agendamento', descricao: 'Marcar novos horários na agenda.' },
  { chave: 'agenda.editar_agendamento', categoria: 'agenda', rotulo: 'Editar agendamento', descricao: 'Alterar data, hora ou serviço de um agendamento existente.' },
  { chave: 'agenda.cancelar_agendamento', categoria: 'agenda', rotulo: 'Cancelar agendamento', descricao: 'Cancelar um horário já marcado.' },
  { chave: 'agenda.editar_valor_servico', categoria: 'agenda', rotulo: 'Editar valor do serviço no agendamento', descricao: 'Mudar manualmente o preço de um serviço na hora de agendar.', critica: true },
  { chave: 'agenda.finalizar_status', categoria: 'agenda', rotulo: 'Marcar agendamento como finalizado', descricao: 'Alterar o status do agendamento para Finalizado.' },
  { chave: 'agenda.agendar_outro_profissional', categoria: 'agenda', rotulo: 'Agendar para outro profissional', descricao: 'Criar agendamento na agenda de um colega, não só na própria.' },

  // ── CAIXA E FECHAMENTO ──────────────────────────────────────────────────
  { chave: 'caixa.fechar_conta', categoria: 'caixa', rotulo: 'Fechar conta no caixa', descricao: 'Abrir e concluir o fechamento de caixa de um cliente.' },
  { chave: 'caixa.retirar_item', categoria: 'caixa', rotulo: 'Retirar item do fechamento', descricao: 'Remover um serviço ou produto já lançado no fechamento.', critica: true },
  { chave: 'caixa.aplicar_desconto', categoria: 'caixa', rotulo: 'Aplicar desconto', descricao: 'Aplicar desconto manual em um item do fechamento.', critica: true },
  { chave: 'caixa.alterar_preco', categoria: 'caixa', rotulo: 'Alterar preço no fechamento', descricao: 'Editar o preço de um item dentro do fechamento de caixa.', critica: true },
  { chave: 'caixa.estornar_pagamento', categoria: 'caixa', rotulo: 'Estornar pagamento', descricao: 'Reverter um pagamento já registrado.', critica: true },
  { chave: 'caixa.alterar_data_fechamento', categoria: 'caixa', rotulo: 'Alterar data de conta fechada', descricao: 'Editar a data de uma conta que já foi fechada.', critica: true },

  // ── COMISSÕES ───────────────────────────────────────────────────────────
  { chave: 'comissoes.ver_proprio_historico', categoria: 'comissoes', rotulo: 'Ver próprio histórico de comissão', descricao: 'Visualizar o histórico de comissões/rateio do próprio profissional.' },
  { chave: 'comissoes.ver_detalhes_recebimento', categoria: 'comissoes', rotulo: 'Ver detalhes de recebimento', descricao: 'Ver quanto falta receber, descontos aplicados, detalhamento.' },

  // ── SEGURANÇA DE DADOS (LGPD) ───────────────────────────────────────────
  { chave: 'dados.ver_cpf_cliente', categoria: 'dados', rotulo: 'Ver CPF de clientes', descricao: 'Visualizar o CPF cadastrado de clientes.' },
  { chave: 'dados.ver_cpf_profissional', categoria: 'dados', rotulo: 'Ver CPF de profissionais', descricao: 'Visualizar o CPF de colegas de equipe.' },
  { chave: 'dados.ver_email_cliente', categoria: 'dados', rotulo: 'Ver e-mail de clientes', descricao: 'Visualizar o e-mail cadastrado de clientes.' },
  { chave: 'dados.ver_telefone_cliente', categoria: 'dados', rotulo: 'Ver telefone de clientes', descricao: 'Visualizar o telefone/WhatsApp cadastrado de clientes.' },
  { chave: 'dados.exportar_clientes', categoria: 'dados', rotulo: 'Exportar lista de clientes', descricao: 'Exportar a base de clientes em massa (CSV/planilha).', critica: true },

  // ── FISCAL ──────────────────────────────────────────────────────────────
  { chave: 'fiscal.cadastrar_parceiro', categoria: 'fiscal', rotulo: 'Cadastrar profissional parceiro', descricao: 'Cadastrar profissional sob a Lei do Salão Parceiro (13.352/2016).' },
  { chave: 'fiscal.editar_dados_fiscais_servico', categoria: 'fiscal', rotulo: 'Editar dados fiscais do serviço', descricao: 'Editar NBS, código municipal e alíquota ISS de um serviço.' },
  { chave: 'fiscal.emitir_nota_retroativa', categoria: 'fiscal', rotulo: 'Emitir nota com data retroativa', descricao: 'Emitir NFS-e com data de movimentação retroativa.', critica: true },

  // ── MÓDULOS/TELAS INTEIRAS ──────────────────────────────────────────────
  { chave: 'modulo.servicos', categoria: 'modulo', rotulo: 'Acessar Serviços e Preços', descricao: 'Ver e editar o catálogo de serviços do salão.' },
  { chave: 'modulo.configuracoes', categoria: 'modulo', rotulo: 'Acessar Configurações', descricao: 'Ver e editar configurações gerais do salão.' },
  { chave: 'modulo.precificacao', categoria: 'modulo', rotulo: 'Acessar Luarys Precifica', descricao: 'Ver a calculadora de precificação e diagnóstico de lucratividade.' },
  { chave: 'modulo.crescimento', categoria: 'modulo', rotulo: 'Acessar Luarys Cresce', descricao: 'Ver relatórios e ferramentas de crescimento do salão.' },
  { chave: 'modulo.financeiro', categoria: 'modulo', rotulo: 'Acessar Financeiro', descricao: 'Ver lançamentos e relatórios financeiros.' },
  { chave: 'modulo.estoque', categoria: 'modulo', rotulo: 'Acessar Estoque', descricao: 'Ver e editar o controle de estoque.' },
  { chave: 'modulo.relatorios', categoria: 'modulo', rotulo: 'Acessar Relatórios', descricao: 'Ver relatórios gerais do salão.' },

  // ── AUDITORIA (ferramentas de fiscalização da própria equipe) ───────────
  { chave: 'auditoria.ver_log_auditoria', categoria: 'auditoria', rotulo: 'Ver log de auditoria', descricao: 'Acessar o histórico de ações sensíveis realizadas no sistema.', critica: true },
  { chave: 'auditoria.ver_cancelamentos', categoria: 'auditoria', rotulo: 'Ver relatório de cancelamentos', descricao: 'Acessar o relatório de agendamentos cancelados.', critica: true },
  { chave: 'auditoria.ver_caixa_nao_bate', categoria: 'auditoria', rotulo: 'Ver alertas de caixa não bate', descricao: 'Acessar o relatório de divergências entre PDV e financeiro.', critica: true },
  { chave: 'auditoria.ver_alertas_estorno', categoria: 'auditoria', rotulo: 'Ver alertas de estorno', descricao: 'Acessar o relatório de estornos realizados no sistema.', critica: true },
];

/**
 * Mapeia chave NOVA → chave ANTIGA equivalente (quando existe). Usado pela
 * função temPermissao() para que perfis já configurados antes da expansão
 * do catálogo continuem funcionando sem reconfiguração.
 */
export const EQUIVALENCIA_ANTIGA: Record<string, string> = {
  'caixa.estornar_pagamento': 'fazer_estorno',
  'caixa.aplicar_desconto': 'aplicar_desconto',
  'comissoes.ver_proprio_historico': 'ver_proprio_faturamento',
  'modulo.financeiro': 'ver_financeiro',
  'agenda.editar_valor_servico': 'editar_valores_proprio_agendamento',
  'agenda.criar_agendamento': 'criar_proprio_agendamento',
};

/**
 * Perfis-base prontos (igual ao conceito "Perfis Padrão" da Trinks).
 * Cada perfil já vem com um conjunto de permissões marcadas como true.
 * Continua coexistindo com os perfis antigos já salvos (Administrador,
 * Recepcionista, Profissional Parceiro, Sem Acesso) — estes têm prioridade
 * quando já estão definidos em profissionais.permissoes.perfil_acesso.
 */
export const PERFIS_BASE: Record<string, string[]> = {
  'Administrador': CATALOGO_PERMISSOES.map(p => p.chave),
  'Recepcionista': [
    'agenda.criar_agendamento', 'agenda.editar_agendamento', 'agenda.cancelar_agendamento',
    'agenda.agendar_outro_profissional', 'agenda.finalizar_status',
    'caixa.fechar_conta', 'caixa.aplicar_desconto',
    'dados.ver_telefone_cliente', 'dados.ver_email_cliente',
  ],
  'Gerente': [
    'agenda.criar_agendamento', 'agenda.editar_agendamento', 'agenda.cancelar_agendamento',
    'agenda.agendar_outro_profissional', 'agenda.finalizar_status', 'agenda.editar_valor_servico',
    'caixa.fechar_conta', 'caixa.aplicar_desconto', 'caixa.alterar_preco', 'caixa.retirar_item',
    'dados.ver_telefone_cliente', 'dados.ver_email_cliente',
    'modulo.relatorios', 'modulo.financeiro',
    'auditoria.ver_cancelamentos',
  ],
  'Profissional': [
    'agenda.criar_agendamento', 'agenda.editar_agendamento', 'agenda.finalizar_status',
    'comissoes.ver_proprio_historico', 'comissoes.ver_detalhes_recebimento',
  ],
  'Profissional Parceiro': [
    'agenda.criar_agendamento', 'agenda.finalizar_status',
    'comissoes.ver_proprio_historico',
  ],
  'Estoquista': ['modulo.estoque'],
  'Sem Acesso': [],
};

/**
 * Permissões CONFIDENCIAIS do salão — expõem dados sensíveis (faturamento,
 * custos/margem, configurações, auditoria, base de clientes). No cadastro do
 * profissional elas ficam TRAVADAS por padrão e só podem ser liberadas com a
 * senha do dono (saloes.pin_gerente). Inclui as chaves novas e as equivalentes
 * antigas, para travar as duas formas de conceder o mesmo acesso.
 */
export const PERMISSOES_CONFIDENCIAIS = new Set<string>([
  'modulo.precificacao',
  'modulo.financeiro', 'ver_financeiro',
  'modulo.relatorios',
  'modulo.configuracoes',
  'modulo.crescimento',
  'ver_dashboard',
  'auditoria.ver_log_auditoria',
  'auditoria.ver_cancelamentos',
  'auditoria.ver_caixa_nao_bate',
  'auditoria.ver_alertas_estorno',
  'dados.exportar_clientes',
]);

export function ehPermissaoConfidencial(chave: string): boolean {
  return PERMISSOES_CONFIDENCIAIS.has(chave);
}

/**
 * Verifica se um profissional tem uma permissão específica.
 *
 * Ordem de checagem:
 * 1. Dono do salão sempre tem acesso total (perfil.isDono === true).
 * 2. Permissão customizada explícita em profissionais.permissoes[chaveNova].
 * 3. Equivalência com chave antiga, se existir (compatibilidade).
 * 4. Permissão padrão do perfil_acesso base (PERFIS_BASE).
 * 5. Se nada encontrado, nega por padrão (fail-safe).
 */
export function temPermissao(perfil: any, chave: string): boolean {
  if (perfil?.isDono) return true;

  const permissoes = perfil?.permissoes || {};

  if (typeof permissoes[chave] === 'boolean') return permissoes[chave];

  const chaveAntiga = EQUIVALENCIA_ANTIGA[chave];
  if (chaveAntiga && typeof permissoes[chaveAntiga] === 'boolean') return permissoes[chaveAntiga];

  const perfilBase = permissoes.perfil_acesso;
  if (perfilBase && PERFIS_BASE[perfilBase]) return PERFIS_BASE[perfilBase].includes(chave);

  return false;
}

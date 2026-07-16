/**
 * src/modules/crescimento/tipos.ts
 *
 * Luarys Cresce — motor de crescimento que unifica em um só lugar:
 *   1. Clientes em risco / perdidos (antes só em Relatórios → Retenção)
 *   2. Horários ociosos (inverso do Relatórios → Termômetro)
 *   3. Profissionais subutilizados (base do Relatórios → Performance)
 *
 * E permite AÇÃO direta a partir de cada insight — antes a ação (Automações)
 * vivia desconectada em Configurações, sem link com o relatório que mostrava
 * o problema.
 *
 * Lógica de cálculo pura (sem React) — usada pelos Paineis e pelo shell.
 */

// ─── INTERFACES ───────────────────────────────────────────────────────────────

export interface ClienteRisco {
  id: string;
  nome: string;
  telefone: string | null;
  dias: number;
  visitas: number;
  aceitaCampanhas: boolean;
  aceitaMarketing: boolean;
}

export interface ClassificacaoClientes {
  fieis: ClienteRisco[];
  emRisco: ClienteRisco[];
  perdidos: ClienteRisco[];
  novos: ClienteRisco[];
  taxaRetencao: number;
}

export interface CelulaHorario {
  dia: string;           // "Segunda", "Terça"...
  diaIndex: number;      // 0=Dom .. 6=Sáb
  hora: number;          // 0-23
  ocupacao: number;      // agendamentos nessa célula no período
  dentroDoExpediente: boolean;
  ocorrenciasDia: number; // quantas vezes esse dia da semana ocorreu no período
}

export interface ProfissionalDesempenho {
  id: string;
  nome: string;
  receita: number;
  atendimentos: number;
  percentDaMedia: number; // receita relativa à média da equipe (100 = na média)
}

export interface DiaFuncionamento {
  dia: string;     // "Segunda-feira"
  ativo: boolean;
  inicio: string;  // "09:00"
  fim: string;     // "19:00"
}

// ─── UTILITÁRIOS DE DATA ──────────────────────────────────────────────────────

const hoje = new Date();
hoje.setHours(0, 0, 0, 0);

export function diasDesde(dataStr: string): number {
  const d = new Date(dataStr + 'T12:00:00');
  return Math.floor((hoje.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

const DIAS_SEMANA_IDX = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
// Deve bater exatamente com o campo `dia` salvo em saloes.horarios_funcionamento
const DIAS_FUNCIONAMENTO_NOME = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

// ─── 1. CLASSIFICAÇÃO DE CLIENTES (em risco / perdidos / fiéis / novos) ───────
// Mesma regra já validada em Relatórios → Retenção (45/90 dias), para não criar
// um segundo número divergente do que o dono já está acostumado a ver.

export function classificarClientes(
  agendamentos: any[],
  clientes: any[],
  crmClientes: any[]
): ClassificacaoClientes {
  const ultimaVisitaPorCliente: Record<string, string> = {};
  const visitasPorCliente: Record<string, number> = {};

  agendamentos
    .filter(ag => ag.status === 'Finalizado' && ag.cliente_id && ag.data)
    .forEach(ag => {
      const atual = ultimaVisitaPorCliente[ag.cliente_id];
      if (!atual || ag.data > atual) ultimaVisitaPorCliente[ag.cliente_id] = ag.data;
      visitasPorCliente[ag.cliente_id] = (visitasPorCliente[ag.cliente_id] || 0) + 1;
    });

  // Só registra falso quando o campo for EXPLICITAMENTE false.
  // null / sem registro em crm_clientes = verde (cliente ainda não gerenciado pelo portal).
  const aceitaCampanhasPorCliente: Record<string, boolean> = {};
  crmClientes.forEach(c => {
    if (c.aceita_campanhas === false) aceitaCampanhasPorCliente[c.cliente_id] = false;
  });

  const fieis: ClienteRisco[] = [];
  const emRisco: ClienteRisco[] = [];
  const perdidos: ClienteRisco[] = [];
  const novos: ClienteRisco[] = [];

  clientes.forEach(c => {
    const ultima = ultimaVisitaPorCliente[c.id];
    if (!ultima) return; // sem visita finalizada — fora da régua de retenção

    const dias = diasDesde(ultima);
    const visitas = visitasPorCliente[c.id] || 0;
    const item: ClienteRisco = {
      id: c.id,
      nome: c.nome_completo || 'Cliente',
      telefone: c.telefone_whatsapp || null,
      dias,
      visitas,
      aceitaCampanhas: aceitaCampanhasPorCliente[c.id] ?? true,
      aceitaMarketing: c.aceita_marketing ?? true,
    };

    if (visitas === 1) novos.push(item);
    else if (dias <= 45) fieis.push(item);
    else if (dias <= 90) emRisco.push(item);
    else perdidos.push(item);
  });

  emRisco.sort((a, b) => b.dias - a.dias);
  perdidos.sort((a, b) => b.dias - a.dias);

  const totalClassificado = fieis.length + emRisco.length + perdidos.length + novos.length;
  const taxaRetencao = totalClassificado > 0 ? Math.round((fieis.length / totalClassificado) * 100) : 0;

  return { fieis, emRisco, perdidos, novos, taxaRetencao };
}

// ─── 2. HORÁRIOS OCIOSOS ───────────────────────────────────────────────────────
// Mesmo princípio do Termômetro (Relatórios), mas invertido: em vez de destacar
// a célula mais cheia, identifica as células mais vazias DENTRO do expediente —
// fora do expediente não conta como "ocioso", é simplesmente fechado.

export function calcularHorariosOciosos(
  agendamentos: any[],
  horariosFuncionamento: DiaFuncionamento[],
  diasNoPeriodo: number
): CelulaHorario[] {
  const funcionamentoPorDia: Record<string, DiaFuncionamento> = {};
  (horariosFuncionamento || []).forEach(h => { funcionamentoPorDia[h.dia] = h; });

  const limite = new Date();
  limite.setDate(limite.getDate() - diasNoPeriodo);
  const limiteStr = limite.toISOString().split('T')[0];

  // Conta apenas os dias em que o salão ESTAVA ABERTO no período
  const ocorrenciasPorDia: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  const refHoje = new Date();
  for (let i = 0; i < diasNoPeriodo; i++) {
    const d = new Date(refHoje);
    d.setDate(refHoje.getDate() - i);
    const diaIdx = d.getDay();
    const nomeFuncionamento = DIAS_FUNCIONAMENTO_NOME[diaIdx];
    const config = funcionamentoPorDia[nomeFuncionamento];
    if (config && config.ativo) ocorrenciasPorDia[diaIdx]++;
  }

  const ocupacaoPorCelula: Record<string, number> = {};
  agendamentos
    .filter(ag => ag.data >= limiteStr && ag.status !== 'Cancelado' && ag.inicio)
    .forEach(ag => {
      const d = new Date(ag.data + 'T12:00:00');
      const diaIdx = d.getDay();
      const hora = parseInt((ag.inicio || '00:00').split(':')[0], 10);
      const chave = `${diaIdx}-${hora}`;
      ocupacaoPorCelula[chave] = (ocupacaoPorCelula[chave] || 0) + 1;
    });

  const celulas: CelulaHorario[] = [];

  for (let diaIdx = 0; diaIdx <= 6; diaIdx++) {
    const nomeFuncionamento = DIAS_FUNCIONAMENTO_NOME[diaIdx];
    const config = funcionamentoPorDia[nomeFuncionamento];
    if (!config || !config.ativo) continue; // dia fechado — não é "ocioso", é fechado

    const horaInicio = parseInt((config.inicio || '09:00').split(':')[0], 10);
    const horaFim = parseInt((config.fim || '19:00').split(':')[0], 10);

    for (let hora = horaInicio; hora < horaFim; hora++) {
      const chave = `${diaIdx}-${hora}`;
      celulas.push({
        dia: DIAS_SEMANA_IDX[diaIdx],
        diaIndex: diaIdx,
        hora,
        ocupacao: ocupacaoPorCelula[chave] || 0,
        dentroDoExpediente: true,
        ocorrenciasDia: ocorrenciasPorDia[diaIdx],
      });
    }
  }

  return celulas;
}

// ─── 3. PROFISSIONAIS SUBUTILIZADOS ────────────────────────────────────────────
// Mesma base de cálculo do ranking de Performance (receita por profissional no
// período), mas ordenado para destacar quem está ABAIXO da média da equipe —
// o ranking original só destaca o topo.

export function calcularDesempenhoProfissionais(
  agendamentos: any[],
  profissionais: any[],
  servicos: any[],
  diasNoPeriodo: number
): ProfissionalDesempenho[] {
  const limite = new Date();
  limite.setDate(limite.getDate() - diasNoPeriodo);
  const limiteStr = limite.toISOString().split('T')[0];

  const servicoPorId: Record<string, any> = {};
  servicos.forEach(s => { servicoPorId[s.id] = s; });

  const receitaPorProf: Record<string, number> = {};
  const atendimentosPorProf: Record<string, number> = {};

  agendamentos
    .filter(ag => ag.status === 'Finalizado' && ag.profissional_id && ag.data >= limiteStr)
    .forEach(ag => {
      const serv = servicoPorId[ag.servico_id];
      const valor = Number(ag.valor_cobrado || ag.valor_total || serv?.preco_padrao || 0);
      receitaPorProf[ag.profissional_id] = (receitaPorProf[ag.profissional_id] || 0) + valor;
      atendimentosPorProf[ag.profissional_id] = (atendimentosPorProf[ag.profissional_id] || 0) + 1;
    });

  const produtivos = profissionais.filter(p => p.produtivo !== false && p.ativo !== false);
  if (produtivos.length === 0) return [];

  const receitaTotal = produtivos.reduce((acc, p) => acc + (receitaPorProf[p.id] || 0), 0);
  const mediaEquipe = receitaTotal / produtivos.length;

  const resultado: ProfissionalDesempenho[] = produtivos.map(p => {
    const receita = receitaPorProf[p.id] || 0;
    return {
      id: p.id,
      nome: p.nome || 'Profissional',
      receita,
      atendimentos: atendimentosPorProf[p.id] || 0,
      percentDaMedia: mediaEquipe > 0 ? Math.round((receita / mediaEquipe) * 100) : 0,
    };
  });

  resultado.sort((a, b) => a.receita - b.receita); // piores primeiro — quem precisa de atenção
  return resultado;
}

// ─── MENSAGEM DE RECUPERAÇÃO E LINK DE WHATSAPP ───────────────────────────────
// Mesmo mecanismo já usado em Configurações → Automações — reaproveitado aqui
// para que a ação aconteça no mesmo lugar em que o problema é mostrado.

export const MENSAGEM_RECUPERACAO_PADRAO =
  'Olá {nome_do_cliente}! Notamos que faz um tempinho que você não vem nos visitar. Que tal agendar um horário e renovar o visual? Estamos com novidades esperando por você! 💇✨';

export function montarMensagem(template: string, nomeCompleto: string): string {
  const primeiroNome = (nomeCompleto || '').split(' ')[0] || 'cliente';
  return template.replaceAll('{nome_do_cliente}', primeiroNome);
}

export function gerarLinkWhatsapp(telefone: string, mensagem: string): string {
  let numero = (telefone || '').replace(/\D/g, '');
  if (numero.length > 0 && numero.length <= 11) numero = '55' + numero;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}

// ─── FORMATAÇÃO ───────────────────────────────────────────────────────────────

export function brl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * src/lib/visitasUtils.ts
 *
 * Fonte única de verdade para agrupamento de visitas e cálculo de receita.
 *
 * PROBLEMA resolvido aqui:
 *   agendamentos.valor_final = preço estimado ao agendar (pode ser 0 em
 *   serviços adicionais ou quando há desconto na conta).
 *   financeiro.valor         = valor REAL pago (fonte correta de receita).
 *
 * Todos os relatórios devem importar daqui ao invés de ler valor_final
 * diretamente, para evitar divergência entre telas.
 */

export type Visita = {
  chave: string;
  financeiro: any | null;
  data: string;
  inicio: string;
  profissional_id: string | null;
  cliente_nome: string;
  status: string;
  valorTotal: number;
  servicoIds: string[];
  agendamentos: any[];
};

/** Constrói map: agendamento_id → registro financeiro que o cobre. */
export function mapAgParaFin(financeiro: any[]): Map<string, any> {
  const m = new Map<string, any>();
  (financeiro || []).forEach((fin: any) => {
    if (Array.isArray(fin.agendamento_ids)) {
      fin.agendamento_ids.forEach((aid: string) => {
        if (typeof aid === 'string') m.set(aid, fin);
      });
    }
  });
  return m;
}

/**
 * Retorna true quando TODOS os agendamentos de um financeiro têm o mesmo
 * profissional — condição para usar fin.valor sem divisão proporcional.
 */
function mapFinUnicoProf(financeiro: any[], todosAgendamentos: any[]): Map<string, boolean> {
  const agPorId = new Map<string, any>();
  (todosAgendamentos || []).forEach((ag: any) => agPorId.set(ag.id, ag));
  const m = new Map<string, boolean>();
  (financeiro || []).forEach((fin: any) => {
    if (!Array.isArray(fin.agendamento_ids)) { m.set(fin.id, true); return; }
    const profs = new Set<string>();
    fin.agendamento_ids.forEach((aid: string) => {
      const ag = agPorId.get(aid);
      if (ag?.profissional_id) profs.add(ag.profissional_id);
    });
    m.set(fin.id, profs.size <= 1);
  });
  return m;
}

/**
 * Agrupa agendamentos em visitas reais do cliente.
 *
 * Regra de agrupamento:
 *  - Agendamentos ligados ao mesmo financeiro + mesmo profissional = 1 visita
 *  - Sem financeiro (não finalizado) = grupo por profissional+cliente+data+hora
 *
 * Valor da visita:
 *  - Quando o financeiro cobre apenas 1 profissional → usa fin.valor (valor real pago)
 *  - Quando cobre múltiplos profissionais → soma dos valor_final individuais
 *
 * @param agendamentos  lista FILTRADA que entra no cálculo
 * @param financeiro    todos os registros de financeiro do salão
 * @param todosAgs      todos os agendamentos (para detectar multi-profissional)
 */
export function agruparEmVisitas(
  agendamentos: any[],
  financeiro: any[],
  todosAgs?: any[],
): Visita[] {
  const mAgFin = mapAgParaFin(financeiro);
  const mUnico = mapFinUnicoProf(financeiro, todosAgs || agendamentos);

  const grupos = new Map<string, {
    chave: string; agendamentos: any[]; financeiro: any | null;
    data: string; inicio: string; profissional_id: string | null;
    cliente_nome: string; status: string;
  }>();

  (agendamentos || []).forEach((ag: any) => {
    const fin = mAgFin.get(ag.id) || null;
    const chave = fin
      ? `fin:${fin.id}:${ag.profissional_id || 'sem'}`
      : `manual:${ag.profissional_id || 'sem'}|${ag.cliente_nome || ''}|${ag.data}|${ag.inicio || ''}`;

    if (!grupos.has(chave)) {
      grupos.set(chave, {
        chave, agendamentos: [], financeiro: fin,
        data: ag.data, inicio: ag.inicio || '',
        profissional_id: ag.profissional_id || null,
        cliente_nome: ag.cliente_nome || 'Cliente não identificado',
        status: ag.status,
      });
    }
    grupos.get(chave)!.agendamentos.push(ag);
  });

  return Array.from(grupos.values()).map(g => {
    const unicoProf = !g.financeiro || mUnico.get(g.financeiro.id) !== false;
    const valorTotal = g.financeiro && unicoProf
      ? Number(g.financeiro.valor || 0)
      : g.agendamentos.reduce((acc, ag) => acc + Number(ag.valor_final || 0), 0);

    const servicoIds = [...new Set(
      g.agendamentos.map((ag: any) => ag.servico_id).filter(Boolean) as string[]
    )];

    return { ...g, valorTotal, servicoIds };
  });
}

/**
 * Valor proporcional de um serviço dentro de uma visita.
 * Uso: ranking de serviços onde cada execução precisa ter um valor.
 * Divide fin.valor igualmente entre todos os agendamentos do financeiro.
 */
export function valorServicoEmVisita(ag: any, fin: any | null): number {
  if (!fin) return Number(ag.valor_final || 0);
  const n = Array.isArray(fin.agendamento_ids) ? fin.agendamento_ids.length : 1;
  if (n <= 0) return Number(ag.valor_final || 0);
  return Number(fin.valor || 0) / n;
}

/** Computa percentual de variação entre dois valores. */
export function delta(atual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return ((atual - anterior) / anterior) * 100;
}

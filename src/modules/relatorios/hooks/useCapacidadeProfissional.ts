'use client'
/**
 * src/modules/relatorios/hooks/useCapacidadeProfissional.ts
 *
 * Lógica central — única fonte de verdade — para calcular capacidade
 * contratada, capacidade efetiva e ocupação real de um profissional
 * (ou de todos), num período. Consumida por:
 *  - GavetaComissoes.tsx (seção de capacidade no demonstrativo individual)
 *  - GavetaCapacidade.tsx (relatório comparativo de todos os profissionais)
 *
 * Conceitos:
 *  - Capacidade contratada: horas que a escala (perfil_avancado.horarios)
 *    prevê para o profissional, dia a dia, dentro do período filtrado.
 *  - Ocorrência de bloqueio: registro em `agendamentos` com status
 *    "Bloqueado", cujo `observacao` carrega o prefixo "[Tipo] motivo"
 *    definido em ModalAusencia.tsx.
 *  - Capacidade efetiva: contratada MENOS as ocorrências cujo tipo tem
 *    descontaCapacidade = true (Liberação não desconta — é folga concedida).
 *  - Horas ocupadas: soma de duracao_min dos agendamentos com status
 *    "Finalizado" no período.
 *  - Taxa de ocupação: horas ocupadas ÷ capacidade efetiva.
 */

import { useMemo } from 'react';
import { TIPOS_BLOQUEIO } from '@/modules/agenda/modals/ModalAusencia';

export type OcorrenciaCapacidade = {
  id: string | number;
  data: string;
  tipo: string;
  motivo: string;
  duracaoMin: number;
  descontaCapacidade: boolean;
};

export type ResultadoCapacidadeProfissional = {
  profissionalId: string;
  nome: string;
  capacidadeContratadaMin: number;
  capacidadeEfetivaMin: number;
  horasOcupadasMin: number;
  taxaOcupacao: number; // 0–1
  descontoPorTipo: Record<string, number>; // minutos descontados por tipo
  ocorrencias: OcorrenciaCapacidade[];
  impactoFinanceiroEstimado: number; // R$ — horas descontadas × ticket médio
};

export type ResultadoCapacidadeCategoria = {
  categoria: string;
  capacidadeContratadaMin: number;
  capacidadeEfetivaMin: number;
  horasOcupadasMin: number;
  taxaOcupacao: number; // 0–1, baseada na capacidade efetiva
  quantidadeProfissionais: number;
};

/**
 * Agrega resultados já calculados por useCapacidadeProfissional em totais
 * por categoria (função do profissional, ex: "Cabelo", "Manicure"). Usado
 * pelo Luarys Precifica para resolver "horas/mês" sem misturar categorias
 * com estruturas de tempo muito diferentes (ex: cabelo vs. unhas).
 *
 * Função pura — não é um hook — para poder ser chamada tanto de dentro de
 * um componente quanto de outra função (ex: dentro do HorasAssistente).
 * categoriaPorProfissionalId deve vir de perfil_avancado.contrato.funcao,
 * com fallback 'Geral' já resolvido pelo chamador.
 */
export function agregarCapacidadePorCategoria(
  resultados: ResultadoCapacidadeProfissional[],
  categoriaPorProfissionalId: Record<string, string>
): ResultadoCapacidadeCategoria[] {
  const mapa: Record<string, ResultadoCapacidadeCategoria> = {};

  resultados.forEach(r => {
    const categoria = categoriaPorProfissionalId[r.profissionalId] || 'Geral';
    if (!mapa[categoria]) {
      mapa[categoria] = {
        categoria,
        capacidadeContratadaMin: 0,
        capacidadeEfetivaMin: 0,
        horasOcupadasMin: 0,
        taxaOcupacao: 0,
        quantidadeProfissionais: 0,
      };
    }
    mapa[categoria].capacidadeContratadaMin += r.capacidadeContratadaMin;
    mapa[categoria].capacidadeEfetivaMin += r.capacidadeEfetivaMin;
    mapa[categoria].horasOcupadasMin += r.horasOcupadasMin;
    mapa[categoria].quantidadeProfissionais += 1;
  });

  return Object.values(mapa).map(c => ({
    ...c,
    taxaOcupacao: c.capacidadeEfetivaMin > 0 ? c.horasOcupadasMin / c.capacidadeEfetivaMin : 0,
  }));
}

const NOMES_DIA_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function extrairTipoEMotivo(observacao: string | null | undefined): { tipo: string; motivo: string } {
  const texto = observacao || '';
  const match = texto.match(/^\[(.+?)\]\s*(.*)$/);
  if (match && TIPOS_BLOQUEIO.some(t => t.valor === match[1])) {
    return { tipo: match[1], motivo: match[2] };
  }
  // Registros antigos (antes da categorização) ou sem prefixo reconhecido
  // entram como "Bloqueio pessoal" — descontam por padrão, sem alarmar
  // o dono com um tipo desconhecido.
  return { tipo: 'Bloqueio pessoal', motivo: texto };
}

function minutosEntre(horaInicio: string, horaFim: string): number {
  const [hI, mI] = horaInicio.split(':').map(Number);
  const [hF, mF] = horaFim.split(':').map(Number);
  const total = (hF * 60 + mF) - (hI * 60 + mI);
  return total > 0 ? total : 0;
}

function capacidadeContratadaDoDia(horarioDia: any): number {
  if (!horarioDia || !horarioDia.ativo) return 0;
  const turno = minutosEntre(horarioDia.entrada, horarioDia.saida);
  const almoco = (horarioDia.almocoEntrada && horarioDia.almocoSaida)
    ? minutosEntre(horarioDia.almocoEntrada, horarioDia.almocoSaida)
    : 0;
  return Math.max(turno - almoco, 0);
}

/**
 * Itera dia a dia (inclusive) entre dataInicio e dataFim, somando a
 * capacidade contratada prevista pela escala do profissional.
 */
function capacidadeContratadaNoPeriodo(horarios: any, dataInicio: string, dataFim: string): number {
  if (!horarios) return 0;
  let total = 0;
  const cursor = new Date(dataInicio + 'T12:00:00');
  const fim = new Date(dataFim + 'T12:00:00');
  while (cursor <= fim) {
    const nomeDia = NOMES_DIA_SEMANA[cursor.getDay()];
    total += capacidadeContratadaDoDia(horarios[nomeDia]);
    cursor.setDate(cursor.getDate() + 1);
  }
  return total;
}

type Params = {
  profissionais: any[];
  agendamentos: any[];
  dataInicio: string; // 'YYYY-MM-DD'
  dataFim: string;    // 'YYYY-MM-DD'
  ticketMedioPorProfissional?: Record<string, number>; // R$/hora, opcional
};

/**
 * Núcleo do cálculo, como função pura (sem useMemo) — para poder ser
 * chamada de qualquer lugar, incluindo fora de componentes React (ex:
 * dentro de um handler assíncrono, como o HorasAssistente do Eleva
 * Precifica). useCapacidadeProfissional (abaixo) é a versão com memoização
 * para uso direto em componentes.
 */
export function calcularCapacidadeProfissionalPura({
  profissionais, agendamentos, dataInicio, dataFim, ticketMedioPorProfissional
}: Params): ResultadoCapacidadeProfissional[] {
  const dentroDoPeriodo = (data: string) => data >= dataInicio && data <= dataFim;

  return (profissionais || []).map((prof: any) => {
    const horarios = prof?.perfil_avancado?.horarios;
    const capacidadeContratadaMin = capacidadeContratadaNoPeriodo(horarios, dataInicio, dataFim);

    const bloqueiosDoProf = (agendamentos || []).filter((ag: any) =>
      ag.profissional_id === prof.id &&
      ag.status === 'Bloqueado' &&
      dentroDoPeriodo(ag.data)
    );

    const ocorrencias: OcorrenciaCapacidade[] = bloqueiosDoProf.map((ag: any) => {
      const { tipo, motivo } = extrairTipoEMotivo(ag.observacao);
      const def = TIPOS_BLOQUEIO.find(t => t.valor === tipo);
      return {
        id: ag.id,
        data: ag.data,
        tipo,
        motivo,
        duracaoMin: Number(ag.duracao_min) || 0,
        descontaCapacidade: def ? def.descontaCapacidade : true,
      };
    });

    const descontoPorTipo: Record<string, number> = {};
    let totalDescontoMin = 0;
    ocorrencias.forEach(o => {
      if (!o.descontaCapacidade) return;
      descontoPorTipo[o.tipo] = (descontoPorTipo[o.tipo] || 0) + o.duracaoMin;
      totalDescontoMin += o.duracaoMin;
    });

    const capacidadeEfetivaMin = Math.max(capacidadeContratadaMin - totalDescontoMin, 0);

    const horasOcupadasMin = (agendamentos || [])
      .filter((ag: any) =>
        ag.profissional_id === prof.id &&
        ag.status === 'Finalizado' &&
        dentroDoPeriodo(ag.data)
      )
      .reduce((soma: number, ag: any) => soma + (Number(ag.duracao_min) || 0), 0);

    const taxaOcupacao = capacidadeEfetivaMin > 0 ? horasOcupadasMin / capacidadeEfetivaMin : 0;

    const ticketHora = ticketMedioPorProfissional?.[prof.id] ?? 0;
    const impactoFinanceiroEstimado = (totalDescontoMin / 60) * ticketHora;

    return {
      profissionalId: prof.id,
      nome: prof.nome,
      capacidadeContratadaMin,
      capacidadeEfetivaMin,
      horasOcupadasMin,
      taxaOcupacao,
      descontoPorTipo,
      ocorrencias: ocorrencias.sort((a, b) => a.data.localeCompare(b.data)),
      impactoFinanceiroEstimado,
    };
  });
}

export function useCapacidadeProfissional(params: Params): ResultadoCapacidadeProfissional[] {
  const { profissionais, agendamentos, dataInicio, dataFim, ticketMedioPorProfissional } = params;
  return useMemo(
    () => calcularCapacidadeProfissionalPura(params),
    [profissionais, agendamentos, dataInicio, dataFim, ticketMedioPorProfissional]
  );
}

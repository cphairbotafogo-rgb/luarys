// src/lib/agendaUtils.ts

/** Converte "HH:MM" em minutos desde 00:00. Vazio/indefinido vira 0. */
export function converterParaMinutos(horaStr: string | undefined | null): number {
  if (!horaStr) return 0;
  const [h, m] = horaStr.split(':').map(Number);
  return h * 60 + m;
}

/** Status que liberam o slot — não participam do cálculo de conflito. */
const STATUS_LIVRES = new Set(['Cancelado', 'Faltou']);

/**
 * Retorna conflitos de horário para um profissional num dia.
 * `ignorarId` exclui o próprio agendamento da comparação (edição).
 *
 * IMPORTANTE: inclui `Aguardando Pagamento` propositalmente — um slot em
 * processo de pagamento pelo portal está OCUPADO e deve bloquear novos
 * agendamentos internos para o mesmo horário.
 */
export function encontrarConflitosDeHorario({
  profissionalId, data, hora, duracaoMin, agendamentos, ignorarId,
}: {
  profissionalId: string | number | null | undefined;
  data: string | null | undefined;
  hora: string | null | undefined;
  duracaoMin: number;
  agendamentos: any[];
  ignorarId?: string | number | null;
}): any[] {
  if (!profissionalId || !data || !hora || !duracaoMin) return [];
  const inicio = converterParaMinutos(hora);
  const fim = inicio + duracaoMin;
  return (agendamentos || []).filter(outro => {
    if (String(outro.id_prof) !== String(profissionalId)) return false;
    if (outro.data !== data) return false;
    if (ignorarId != null && String(outro.id) === String(ignorarId)) return false;
    if (STATUS_LIVRES.has(outro.status)) return false;
    const outroInicio = converterParaMinutos(outro.inicio);
    const outroFim = outroInicio + (outro.duracaoMin || 60);
    return inicio < outroFim && fim > outroInicio;
  });
}

/** Verdadeiro se algum dos conflitos tem pagamento de portal em andamento. */
export function temConflitoPagamentoPortal(conflitos: any[]): boolean {
  return conflitos.some(c => c.status === 'Aguardando Pagamento');
}

// ─── Paleta oficial de status — idêntica à sidebar ──────────────────────────
// FONTE DA VERDADE: qualquer alteração aqui reflete automaticamente em
// AgendaGrid (cor do card), MenuContextoAgendamento (bolinhas) e
// AgendaSidebar (legenda). Nunca hardcode cores de status em outro arquivo.
export const COR_POR_STATUS: Record<string, string> = {
  'Agendado':              '#1E293B',   // Quase preto — estado inicial ainda sem confirmação
  'Confirmado':            '#94A3B8',   // Cinza — cliente confirmou presença
  'Aguardando':            '#D4AF37',   // Dourado Luarys — cliente chegou, aguarda vez
  'Em Atendimento':        '#3B82F6',   // Azul — serviço em andamento
  'Finalizado':            '#4F9D6E',   // Verde vivo — atendimento concluído
  'Cancelado':             '#EF4444',   // Vermelho — opacidade aplicada no card
  'Faltou':                '#EF4444',   // Vermelho + borda tracejada no card
  'Bloqueado':             '#64748B',   // Cor de fallback — cada bloqueio usa ag.cor do banco
  'Aguardando Pagamento':  '#F59E0B',   // Âmbar — reserva portal pendente de sinal
};

/**
 * Retorna a cor correta para renderizar o card na grade.
 * Todos os status (exceto Bloqueado) têm cor fixa definida em COR_POR_STATUS —
 * ignoram a cor customizada salva no banco. Bloqueio usa ag.cor (salvo por
 * salvarAusencia com a cor correta por tipo).
 */
export function corPorStatus(ag: { status?: string; cor?: string }): string {
  const status = ag.status || 'Agendado';
  if (status === 'Bloqueado') return ag.cor || COR_POR_STATUS['Bloqueado'];
  return COR_POR_STATUS[status] || ag.cor || '#1E293B';
}

/** Retorna lista de status disponíveis para transição a partir do status atual */
export function statusDisponiveis(statusAtual: string): string[] {
  const todos = ['Aguardando', 'Confirmado', 'Em Atendimento', 'Finalizado'];
  return todos.filter(s => s !== statusAtual);
}

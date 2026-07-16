/**
 * src/lib/aniversarios.ts
 *
 * Lógica central de aniversários — compartilhada entre:
 *   - GavetaAniversariantes (relatório)
 *   - ModalEdicao (agendamento)
 *   - ModalNovoAgendamento (novo agendamento)
 *   - AbaDashboard (alertas de 7 dias)
 *   - Portal do cliente (alerta ao agendar)
 */

export type StatusAniversario =
  | 'hoje'      // aniversário é hoje
  | 'alerta'    // aniversário em 1-7 dias, sem agendamento no mês
  | 'agendado'  // tem agendamento futuro no mês do aniversário
  | 'veio'      // já veio (agendamento Finalizado no mês)
  | 'pendente'  // aniversário no mês, mas não veio e não agendou
  | null;       // não faz aniversário no período

export interface InfoAniversario {
  status: StatusAniversario;
  diasAteAniversario: number;  // negativo = já passou, 0 = hoje, positivo = falta
  diaAniversario: number;
  mesAniversario: number;
  label: string;
  cor: string;
  emoji: string;
}

// ─── CALCULAR STATUS ──────────────────────────────────────────────────────────
export function calcularStatusAniversario(
  nascimento: string | null | undefined,
  agendamentos: any[],            // todos os agendamentos do cliente no salão
  clienteId: string,
  mesReferencia?: number,         // 0-11, padrão = mês atual
  anoReferencia?: number,
): InfoAniversario | null {

  if (!nascimento) return null;

  const nasc  = new Date(nascimento + 'T12:00:00');
  const hoje  = new Date();
  hoje.setHours(0, 0, 0, 0);

  const mes = mesReferencia !== undefined ? mesReferencia : hoje.getMonth();
  const ano = anoReferencia !== undefined ? anoReferencia : hoje.getFullYear();

  const diaAniv = nasc.getDate();
  const mesAniv = nasc.getMonth(); // 0-11

  // Só interessa se o aniversário é no mês de referência
  if (mesAniv !== mes) return null;

  // Data do aniversário neste ano
  const dataAniv = new Date(ano, mesAniv, diaAniv);
  dataAniv.setHours(0, 0, 0, 0);

  const diasAte = Math.round((dataAniv.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

  // Agendamentos do cliente no mês de referência
  const agsMes = agendamentos.filter((ag: any) => {
    if (!ag.data) return false;
    const d = new Date(ag.data + 'T12:00:00');
    return (
      (ag.cliente_id === clienteId || ag.cliente_id === clienteId) &&
      d.getMonth() === mes && d.getFullYear() === ano
    );
  });

  const jaVeio    = agsMes.some((ag: any) => ag.status === 'Finalizado');
  const agendado  = agsMes.some((ag: any) => ['Confirmado', 'Pendente'].includes(ag.status));

  let status: StatusAniversario;
  let label: string;
  let cor: string;
  let emoji: string;

  if (diasAte === 0) {
    status = 'hoje';
    label  = '🎂 Aniversário hoje!';
    cor    = '#F59E0B';
    emoji  = '🎂';
  } else if (jaVeio) {
    status = 'veio';
    label  = `✅ Já veio este mês`;
    cor    = '#10B981';
    emoji  = '✅';
  } else if (agendado) {
    status = 'agendado';
    label  = `📅 Agendado para o mês`;
    cor    = '#3B82F6';
    emoji  = '📅';
  } else if (diasAte > 0 && diasAte <= 7) {
    status = 'alerta';
    label  = `⚠️ Aniversário em ${diasAte} dia${diasAte > 1 ? 's' : ''}`;
    cor    = '#EF4444';
    emoji  = '⚠️';
  } else {
    status = 'pendente';
    label  = diasAte < 0
      ? `⏳ Aniversário foi dia ${diaAniv} — ainda não veio`
      : `⏳ Aniversário dia ${diaAniv}`;
    cor    = '#94A3B8';
    emoji  = '⏳';
  }

  return { status, diasAteAniversario: diasAte, diaAniversario: diaAniv, mesAniversario: mesAniv, label, cor, emoji };
}

// ─── FILTRAR ANIVERSARIANTES ──────────────────────────────────────────────────
export type FiltroAniversario = 'dia' | 'semana' | 'mes';

export function filtrarAniversariantes(
  clientes: any[],
  agendamentos: any[],
  filtro: FiltroAniversario,
): Array<{ cliente: any; info: InfoAniversario }> {

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const resultados: Array<{ cliente: any; info: InfoAniversario }> = [];

  clientes.forEach((c: any) => {
    if (!c.nascimento) return;

    const nasc   = new Date(c.nascimento + 'T12:00:00');
    const diaAniv = nasc.getDate();
    const mesAniv = nasc.getMonth();
    const dataAniv = new Date(hoje.getFullYear(), mesAniv, diaAniv);
    dataAniv.setHours(0, 0, 0, 0);

    const diasAte = Math.round((dataAniv.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

    // Aplicar filtro
    if (filtro === 'dia'    && diasAte !== 0) return;
    if (filtro === 'semana' && (diasAte < 0 || diasAte > 7)) return;
    if (filtro === 'mes'    && mesAniv !== hoje.getMonth()) return;

    // Para filtro mês, permitir aniversários já passados no mês corrente
    if (filtro === 'mes' && diasAte < -31) return;

    const agsCliente = agendamentos.filter((ag: any) => ag.cliente_id === c.id);
    const info = calcularStatusAniversario(c.nascimento, agsCliente, c.id, mesAniv, hoje.getFullYear());

    if (info) resultados.push({ cliente: c, info });
  });

  // Ordenar: hoje primeiro, depois alerta, depois por dia do aniversário
  const ordem: Record<string, number> = { hoje: 0, alerta: 1, agendado: 2, pendente: 3, veio: 4 };
  return resultados.sort((a, b) => {
    const ordemA = ordem[a.info.status || 'pendente'] ?? 5;
    const ordemB = ordem[b.info.status || 'pendente'] ?? 5;
    if (ordemA !== ordemB) return ordemA - ordemB;
    return a.info.diaAniversario - b.info.diaAniversario;
  });
}

// ─── MONTAR MENSAGEM DE PARABÉNS PARA WHATSAPP ───────────────────────────────
export const MSG_ANIVERSARIO_PADRAO =
  "🎉 Feliz Aniversário, {nome_do_cliente}!\n\nA equipe do {nome_salao} deseja um dia incrível para você! 🎂✨\n\nQue tal comemorar com um mimo especial? Temos uma surpresa para você este mês. 💛";

export function montarMsgAniversario(
  nomeCliente: string,
  nomeSalao: string,
  template?: string | null,
): string {
  const primeiroNome = nomeCliente.split(' ')[0];
  const base = template || MSG_ANIVERSARIO_PADRAO;
  return base
    .replace(/\{nome_do_cliente\}/g, primeiroNome)
    .replace(/\{nome_salao\}/g, nomeSalao);
}
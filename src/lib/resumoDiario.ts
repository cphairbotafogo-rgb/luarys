/**
 * src/lib/resumoDiario.ts
 *
 * Monta o resumo diário que o salão recebe por e-mail de madrugada: como foi o
 * fechamento de ontem e a agenda de hoje.
 *
 * Decisões tomadas com o Ari (04/08/2026), comparando com o e-mail equivalente
 * da Trinks:
 *  - SEM telefone do cliente no corpo. Telefone é dado do titular e ficaria
 *    arquivado na caixa postal de quem recebe, sem criptografia, todo dia. O
 *    e-mail traz nome/hora/serviço e o dono abre o sistema para o contato.
 *    (Incluir telefone é uma possibilidade futura — ver CLAUDE.md.)
 *  - Envia MESMO em dia sem movimento, para manter o hábito.
 *  - Sem bloco de caixa físico (abertura/sangria/troco): o Luarys não tem o
 *    conceito de sessão de caixa hoje.
 *
 * O que temos e a Trinks não mostra: o split REAL por forma de pagamento
 * (financeiro.pagamentos), e não só o total do dia.
 */

const FUSO = 'America/Sao_Paulo';

/** Data no fuso de Brasília no formato YYYY-MM-DD, com deslocamento em dias. */
export function dataBrasilia(deslocamentoDias = 0): string {
  const agora = new Date();
  const local = new Date(agora.toLocaleString('en-US', { timeZone: FUSO }));
  local.setDate(local.getDate() + deslocamentoDias);
  return local.toISOString().split('T')[0];
}

export function formatarBRL(v: number): string {
  return `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;
}

function escaparHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export interface LinhaFinanceiro {
  valor: number | null;
  categoria: string | null;
  status: string | null;
  cliente_nome: string | null;
  pagamentos: Record<string, number> | null;
}

export interface LinhaAgendamento {
  inicio: string | null;
  cliente_nome: string | null;
  status: string | null;
  servicos?: { nome_servico?: string | null } | null;
  profissionais?: { nome?: string | null } | null;
}

export interface ResumoCalculado {
  totalRecebido: number;
  porCategoria: Record<string, number>;
  porFormaPagamento: Record<string, number>;
  fiadoQtd: number;
  fiadoValor: number;
  vendasQtd: number;
}

const ROTULO_FORMA: Record<string, string> = {
  pix: 'PIX', credito: 'Cartão de Crédito', debito: 'Cartão de Débito',
  dinheiro: 'Dinheiro', cheque: 'Cheque', prePago: 'Pré-pago',
};

export function calcularResumo(linhas: LinhaFinanceiro[]): ResumoCalculado {
  const r: ResumoCalculado = {
    totalRecebido: 0, porCategoria: {}, porFormaPagamento: {},
    fiadoQtd: 0, fiadoValor: 0, vendasQtd: 0,
  };

  for (const l of linhas) {
    const valor = Number(l.valor) || 0;
    r.vendasQtd += 1;

    // Fiado = lançamento de entrada que ficou 'Pendente' no fechamento.
    if (l.status === 'Pendente') {
      r.fiadoQtd += 1;
      r.fiadoValor += valor;
    } else {
      r.totalRecebido += valor;
    }

    const cat = l.categoria || 'Outros';
    r.porCategoria[cat] = (r.porCategoria[cat] || 0) + valor;

    // Split real por forma de pagamento. Vendas antigas (anteriores à coluna
    // `pagamentos`) não têm o detalhe — entram como 'Não detalhado' em vez de
    // sumirem da soma.
    if (l.pagamentos && typeof l.pagamentos === 'object') {
      let somaSplit = 0;
      for (const [forma, v] of Object.entries(l.pagamentos)) {
        const n = Number(v) || 0;
        if (n <= 0) continue;
        const rotulo = ROTULO_FORMA[forma] || forma;
        r.porFormaPagamento[rotulo] = (r.porFormaPagamento[rotulo] || 0) + n;
        somaSplit += n;
      }
      if (somaSplit <= 0 && valor > 0) {
        r.porFormaPagamento['Não detalhado'] = (r.porFormaPagamento['Não detalhado'] || 0) + valor;
      }
    } else if (valor > 0) {
      r.porFormaPagamento['Não detalhado'] = (r.porFormaPagamento['Não detalhado'] || 0) + valor;
    }
  }

  return r;
}

/** CSV da agenda para o anexo — o contador/recepção abre sem precisar de login. */
export function csvAgenda(ags: LinhaAgendamento[]): string {
  const bom = '﻿';
  const esc = (c: unknown) => `"${String(c ?? '').replace(/"/g, '""')}"`;
  const cab = ['Hora', 'Profissional', 'Servico', 'Cliente', 'Status'];
  const linhas = ags.map(a => [
    (a.inicio || '').slice(0, 5),
    a.profissionais?.nome || '',
    a.servicos?.nome_servico || '',
    a.cliente_nome || '',
    a.status || '',
  ]);
  return bom + [cab, ...linhas].map(l => l.map(esc).join(';')).join('\n');
}

function tabela(titulo: string, linhas: [string, string][]): string {
  if (linhas.length === 0) return '';
  const corpo = linhas.map(([k, v]) => `
    <tr>
      <td style="padding:7px 10px;border-bottom:1px solid #E8E5DE;font-size:13px;color:#2C3643;">${escaparHtml(k)}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #E8E5DE;font-size:13px;color:#2C3643;text-align:right;font-weight:600;">${escaparHtml(v)}</td>
    </tr>`).join('');
  return `
    <h3 style="margin:26px 0 8px;font-size:13px;font-weight:700;color:#2C3643;text-transform:uppercase;letter-spacing:.5px;">${escaparHtml(titulo)}</h3>
    <table style="width:100%;border-collapse:collapse;border:1px solid #E8E5DE;">${corpo}</table>`;
}

export function montarHtmlResumo(opts: {
  nomeSalao: string;
  dataOntemLabel: string;
  dataHojeLabel: string;
  resumo: ResumoCalculado;
  agendamentos: LinhaAgendamento[];
}): string {
  const { nomeSalao, dataOntemLabel, dataHojeLabel, resumo, agendamentos } = opts;

  const linhasAgenda = agendamentos.length === 0
    ? `<tr><td colspan="4" style="padding:16px;text-align:center;font-size:13px;color:#8A8577;">Nenhum agendamento para hoje.</td></tr>`
    : agendamentos.map(a => `
        <tr>
          <td style="padding:7px 10px;border-bottom:1px solid #E8E5DE;font-size:13px;">${escaparHtml((a.inicio || '').slice(0, 5))}</td>
          <td style="padding:7px 10px;border-bottom:1px solid #E8E5DE;font-size:13px;">${escaparHtml(a.profissionais?.nome || '—')}</td>
          <td style="padding:7px 10px;border-bottom:1px solid #E8E5DE;font-size:13px;">${escaparHtml(a.servicos?.nome_servico || '—')}</td>
          <td style="padding:7px 10px;border-bottom:1px solid #E8E5DE;font-size:13px;">${escaparHtml(a.cliente_nome || '—')}</td>
        </tr>`).join('');

  const categorias = Object.entries(resumo.porCategoria)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => [k, formatarBRL(v)] as [string, string]);

  const formas = Object.entries(resumo.porFormaPagamento)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => [k, formatarBRL(v)] as [string, string]);

  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#FAFAF9;">
    <h1 style="margin:0 0 4px;font-size:20px;font-weight:800;color:#2C3643;">${escaparHtml(nomeSalao)}</h1>
    <p style="margin:0 0 24px;font-size:13px;color:#8A8577;">Resumo de ${escaparHtml(dataOntemLabel)} e agenda de ${escaparHtml(dataHojeLabel)}</p>

    <div style="background:#fff;border:1px solid #E8E5DE;border-radius:10px;padding:20px;">
      <div style="text-align:center;padding:8px 0 18px;border-bottom:1px solid #E8E5DE;">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#8A8577;text-transform:uppercase;letter-spacing:1px;">Recebido em ${escaparHtml(dataOntemLabel)}</p>
        <p style="margin:0;font-size:30px;font-weight:800;color:#2C3643;">${formatarBRL(resumo.totalRecebido)}</p>
        <p style="margin:6px 0 0;font-size:12px;color:#8A8577;">${resumo.vendasQtd} lançamento(s) no dia</p>
      </div>

      ${tabela('Por forma de pagamento', formas)}
      ${tabela('Por categoria', categorias)}

      ${resumo.fiadoQtd > 0 ? `
        <div style="margin-top:24px;padding:14px 16px;border-radius:8px;background:#FFFBEB;border:1px solid #FDE68A;">
          <p style="margin:0;font-size:13px;font-weight:700;color:#92400E;">
            ${resumo.fiadoQtd} conta(s) em aberto — ${formatarBRL(resumo.fiadoValor)}
          </p>
          <p style="margin:4px 0 0;font-size:12px;color:#B45309;">Fechamentos marcados como fiado ontem.</p>
        </div>` : ''}

      <h3 style="margin:30px 0 8px;font-size:13px;font-weight:700;color:#2C3643;text-transform:uppercase;letter-spacing:.5px;">Agenda de ${escaparHtml(dataHojeLabel)}</h3>
      <table style="width:100%;border-collapse:collapse;border:1px solid #E8E5DE;">
        <thead>
          <tr style="background:#FAFAF9;">
            <th style="padding:8px 10px;text-align:left;font-size:11px;color:#8A8577;text-transform:uppercase;">Hora</th>
            <th style="padding:8px 10px;text-align:left;font-size:11px;color:#8A8577;text-transform:uppercase;">Profissional</th>
            <th style="padding:8px 10px;text-align:left;font-size:11px;color:#8A8577;text-transform:uppercase;">Serviço</th>
            <th style="padding:8px 10px;text-align:left;font-size:11px;color:#8A8577;text-transform:uppercase;">Cliente</th>
          </tr>
        </thead>
        <tbody>${linhasAgenda}</tbody>
      </table>
      <p style="margin:10px 0 0;font-size:11px;color:#8A8577;">
        A agenda completa vai em anexo (agendamentos.csv). Para telefone e demais dados do cliente, acesse o Luarys.
      </p>
    </div>

    <p style="margin:20px 0 0;font-size:11px;color:#8A8577;text-align:center;">
      Enviado automaticamente pelo <strong style="color:#2C3643;">Luarys</strong>.
    </p>
  </div>`;
}

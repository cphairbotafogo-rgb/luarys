// supabase/functions/enviar-relatorio-contabil/index.ts
// Edge Function: gera CSVs de Faturamento, Despesas e Comissões e envia por e-mail via Resend.
// Variáveis de ambiente necessárias (painel Supabase → Settings → Edge Functions → Secrets):
//   RESEND_API_KEY  — chave da API do Resend (resend.com)
//   SUPABASE_URL    — já injetado automaticamente pelo runtime
//   SUPABASE_SERVICE_ROLE_KEY — já injetado automaticamente pelo runtime

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── helpers CSV ────────────────────────────────────────────────────────────

function fmtData(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso.includes('T') ? iso : iso + 'T12:00:00Z');
  return d.toLocaleDateString('pt-BR');
}

function fmtValor(v: unknown): string {
  return Number(v || 0).toFixed(2).replace('.', ',');
}

function gerarCSV(cabecalho: string[], linhas: (string | number | null)[][]): string {
  const bom = '﻿';
  const toRow = (cells: (string | number | null)[]) =>
    cells.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';');
  return bom + [cabecalho, ...linhas].map(toRow).join('\n');
}

// ── geração dos relatórios ─────────────────────────────────────────────────

async function gerarFaturamento(supabase: any, salaoId: string, inicio: string, fim: string) {
  const { data } = await supabase
    .from('financeiro')
    .select('os_numero,cliente_nome,descricao,profissional_nome,forma_pagamento,bandeira_cartao,valor,status,data_movimentacao')
    .eq('salao_id', salaoId)
    .eq('tipo', 'entrada')
    .neq('status', 'Estornado')
    .gte('data_movimentacao', inicio)
    .lte('data_movimentacao', fim)
    .order('data_movimentacao');

  const cabecalho = ['Data', 'OS', 'Cliente', 'Descrição', 'Profissional', 'Forma Pgto', 'Bandeira', 'Valor (R$)', 'Status'];
  const linhas = (data || []).map((r: any) => [
    fmtData(r.data_movimentacao), r.os_numero || '', r.cliente_nome || '',
    r.descricao || '', r.profissional_nome || '',
    r.forma_pagamento || '', r.bandeira_cartao || '',
    fmtValor(r.valor), r.status || '',
  ]);
  return { csv: gerarCSV(cabecalho, linhas), total: data?.length ?? 0 };
}

async function gerarDespesas(supabase: any, salaoId: string, inicioData: string, fimData: string) {
  const { data: dVenc } = await supabase
    .from('despesas')
    .select('descricao,categoria,tipo_custo,valor,data_vencimento,data_pagamento,forma_pagamento,status')
    .eq('salao_id', salaoId)
    .gte('data_vencimento', inicioData)
    .lte('data_vencimento', fimData);

  const { data: dPago } = await supabase
    .from('despesas')
    .select('descricao,categoria,tipo_custo,valor,data_vencimento,data_pagamento,forma_pagamento,status')
    .eq('salao_id', salaoId)
    .gte('data_pagamento', inicioData)
    .lte('data_pagamento', fimData);

  const mapa = new Map<string, any>();
  [...(dVenc || []), ...(dPago || [])].forEach((d: any) => {
    mapa.set(`${d.descricao}|${d.valor}|${d.data_vencimento}`, d);
  });
  const rows = Array.from(mapa.values());

  const cabecalho = ['Vencimento', 'Pagamento', 'Descrição', 'Categoria', 'Tipo', 'Forma Pgto', 'Valor (R$)', 'Status'];
  const linhas = rows.map((r: any) => [
    fmtData(r.data_vencimento), fmtData(r.data_pagamento),
    r.descricao || '', r.categoria || '', r.tipo_custo || '',
    r.forma_pagamento || '', fmtValor(r.valor), r.status || '',
  ]);
  return { csv: gerarCSV(cabecalho, linhas), total: rows.length };
}

async function gerarComissoes(supabase: any, salaoId: string, inicio: string, fim: string) {
  const { data } = await supabase
    .from('comissoes')
    .select('servico_nome,valor_servico,porcentagem_comissao,valor_comissao,status,created_at,profissionais(nome),agendamentos(cliente_nome)')
    .eq('salao_id', salaoId)
    .gte('created_at', inicio)
    .lte('created_at', fim)
    .order('created_at');

  const cabecalho = ['Data', 'Profissional', 'Cliente', 'Serviço', '% Comissão', 'Valor Serviço (R$)', 'Comissão (R$)', 'Status'];
  const linhas = (data || []).map((r: any) => [
    fmtData(r.created_at),
    r.profissionais?.nome || '',
    r.agendamentos?.cliente_nome || '',
    r.servico_nome || '',
    `${Number(r.porcentagem_comissao || 0).toFixed(0)}%`,
    fmtValor(r.valor_servico),
    fmtValor(r.valor_comissao),
    r.status || '',
  ]);
  return { csv: gerarCSV(cabecalho, linhas), total: data?.length ?? 0 };
}

// ── handler principal ──────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const { salao_id, mes } = await req.json() as { salao_id: string; mes: string };
    if (!salao_id || !mes) {
      return new Response(JSON.stringify({ error: 'salao_id e mes são obrigatórios.' }), { status: 400, headers: CORS });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Dados do salão
    const { data: salao } = await supabase
      .from('saloes')
      .select('nome_fantasia,razao_social,cnpj,email_contador')
      .eq('id', salao_id)
      .single();

    if (!salao?.email_contador) {
      return new Response(
        JSON.stringify({ error: 'E-mail do contador não configurado. Acesse Configurações → Contabilidade.' }),
        { status: 422, headers: CORS },
      );
    }

    // Período
    const [ano, m] = mes.split('-').map(Number);
    const inicio = new Date(ano, m - 1, 1).toISOString();
    const fim    = new Date(ano, m, 0, 23, 59, 59, 999).toISOString();
    const inicioData = `${ano}-${String(m).padStart(2, '0')}-01`;
    const fimData    = new Date(ano, m, 0).toISOString().split('T')[0];
    const mesLabel   = `${String(m).padStart(2, '0')}-${ano}`;

    // Gera os três CSVs em paralelo
    const [fat, desp, com] = await Promise.all([
      gerarFaturamento(supabase, salao_id, inicio, fim),
      gerarDespesas(supabase, salao_id, inicioData, fimData),
      gerarComissoes(supabase, salao_id, inicio, fim),
    ]);

    const nomeEmpresa = salao.nome_fantasia || salao.razao_social || 'Salão';
    const cnpj        = salao.cnpj ? ` · CNPJ ${salao.cnpj}` : '';

    // Envia via Resend
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY não configurada.' }), { status: 500, headers: CORS });
    }

    const emailPayload = {
      from: `${nomeEmpresa} via Eleva <relatorios@eleva.app>`,
      to: [salao.email_contador],
      subject: `Relatório Contábil – ${nomeEmpresa} – ${mesLabel.replace('-', '/')}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f8fafc">
          <div style="background:#1e293b;padding:24px;border-radius:12px;text-align:center;margin-bottom:24px">
            <h1 style="color:#fff;margin:0;font-size:22px">${nomeEmpresa}</h1>
            <p style="color:rgba(255,255,255,0.6);margin:8px 0 0;font-size:13px">${cnpj}</p>
          </div>
          <div style="background:#fff;padding:24px;border-radius:12px;border:1px solid #e2e8f0">
            <p style="margin:0 0 16px;font-size:15px;color:#1e293b">
              Segue em anexo o relatório contábil referente a <strong>${mesLabel.replace('-', '/')}</strong>.
            </p>
            <table style="width:100%;border-collapse:collapse">
              <tr style="background:#f8fafc">
                <td style="padding:10px 14px;font-size:13px;font-weight:700;color:#475569;border:1px solid #e2e8f0">📊 Faturamento</td>
                <td style="padding:10px 14px;font-size:13px;color:#64748b;border:1px solid #e2e8f0">${fat.total} registros</td>
              </tr>
              <tr>
                <td style="padding:10px 14px;font-size:13px;font-weight:700;color:#475569;border:1px solid #e2e8f0">📉 Despesas</td>
                <td style="padding:10px 14px;font-size:13px;color:#64748b;border:1px solid #e2e8f0">${desp.total} registros</td>
              </tr>
              <tr style="background:#f8fafc">
                <td style="padding:10px 14px;font-size:13px;font-weight:700;color:#475569;border:1px solid #e2e8f0">👥 Comissões</td>
                <td style="padding:10px 14px;font-size:13px;color:#64748b;border:1px solid #e2e8f0">${com.total} registros</td>
              </tr>
            </table>
            <p style="margin:20px 0 0;font-size:12px;color:#94a3b8">
              Enviado automaticamente pelo sistema Eleva · ${new Date().toLocaleString('pt-BR')}
            </p>
          </div>
        </div>
      `,
      attachments: [
        { filename: `faturamento_${mesLabel}.csv`, content: btoa(unescape(encodeURIComponent(fat.csv))) },
        { filename: `despesas_${mesLabel}.csv`,    content: btoa(unescape(encodeURIComponent(desp.csv))) },
        { filename: `comissoes_${mesLabel}.csv`,   content: btoa(unescape(encodeURIComponent(com.csv))) },
      ],
    };

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(emailPayload),
    });

    if (!resendRes.ok) {
      const err = await resendRes.text();
      return new Response(JSON.stringify({ error: `Resend: ${err}` }), { status: 502, headers: CORS });
    }

    return new Response(
      JSON.stringify({ ok: true, destinatario: salao.email_contador, registros: fat.total + desp.total + com.total }),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS });
  }
});

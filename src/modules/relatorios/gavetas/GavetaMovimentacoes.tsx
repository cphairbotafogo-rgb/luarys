'use client'

import { useState, useMemo, Fragment } from 'react';
import { C, brl } from '@/lib/constants';
import { RAIO_MD, RAIO_XL } from '@/lib/estiloGlobal';
import { FiDownload, FiFilter, FiChevronDown, FiChevronRight } from 'react-icons/fi';
import { InputData } from '@/components/InputData';

const CATEGORIAS_SERVICO = ['Serviços Prestados', 'Receita de Serviços'];
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// Converte timestamp UTC do banco para YYYY-MM-DD no fuso local do navegador.
// Sem isso, vendas feitas após 21h (BRT) apareceriam no dia seguinte no UTC.
function localDateStr(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(String(iso));
  if (isNaN(d.getTime())) return String(iso).substring(0, 10);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().substring(0, 10);
}
function formatarData(s: string) {
  if (!s) return '';
  const [ano, mes, dia] = String(s).substring(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}
function labelMes(ym: string) {
  const [a, m] = ym.split('-');
  return `${MESES[Number(m) - 1]} / ${a}`;
}
function horaDe(f: any) {
  const iso = String(f.data_movimentacao || '');
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().substring(11, 16);
}

type Cols = { servicos: number; produtos: number; descontos: number; credito: number; debito: number; dinheiro: number; pix: number; prePago: number; outros: number; total: number };
const ZERO: Cols = { servicos: 0, produtos: 0, descontos: 0, credito: 0, debito: 0, dinheiro: 0, pix: 0, prePago: 0, outros: 0, total: 0 };

// Colunas de UMA linha do financeiro. Usa o split exato (pagamentos jsonb) quando existe;
// senão (vendas antigas), joga o valor cheio na forma de pagamento dominante.
function colunas(f: any): Cols {
  const valor = Number(f.valor || 0);
  const ehServico = CATEGORIAS_SERVICO.includes(f.categoria);
  const ehProduto = f.categoria === 'Venda de Produtos';
  let credito = 0, debito = 0, dinheiro = 0, pix = 0, prePago = 0, outros = 0;
  const pg = f.pagamentos;
  const somaSplit = pg && typeof pg === 'object'
    ? Number(pg.credito || 0) + Number(pg.debito || 0) + Number(pg.dinheiro || 0) + Number(pg.pix || 0) + Number(pg.prePago || 0) + Number(pg.cheque || 0)
    : 0;
  if (somaSplit > 0) {
    credito = Number(pg.credito || 0); debito = Number(pg.debito || 0); dinheiro = Number(pg.dinheiro || 0);
    pix = Number(pg.pix || 0); prePago = Number(pg.prePago || 0); outros = Number(pg.cheque || 0);
  } else {
    const fp = String(f.forma_pagamento || f.metodo_pagamento || '').toLowerCase();
    if (fp.includes('créd') || fp.includes('cred')) credito = valor;
    else if (fp.includes('déb') || fp.includes('deb')) debito = valor;
    else if (fp.includes('dinheiro') || fp.includes('cash')) dinheiro = valor;
    else if (fp.includes('pix')) pix = valor;
    else if (fp.includes('pré') || fp.includes('pre')) prePago = valor;
    else outros = valor;
  }
  return { servicos: ehServico ? valor : 0, produtos: ehProduto ? valor : 0, descontos: Number(f.desconto || 0), credito, debito, dinheiro, pix, prePago, outros, total: valor };
}
const somar = (a: Cols, b: Cols): Cols => ({
  servicos: a.servicos + b.servicos, produtos: a.produtos + b.produtos, descontos: a.descontos + b.descontos,
  credito: a.credito + b.credito, debito: a.debito + b.debito, dinheiro: a.dinheiro + b.dinheiro,
  pix: a.pix + b.pix, prePago: a.prePago + b.prePago, outros: a.outros + b.outros, total: a.total + b.total,
});

const COLUNAS_LABEL = ['Serviços', 'Produtos', 'Desc.', 'Crédito', 'Débito', 'Dinheiro', 'PIX', 'Pré-Pago', 'Outros', 'Total'];
function valores(c: Cols): number[] {
  return [c.servicos, c.produtos, c.descontos, c.credito, c.debito, c.dinheiro, c.pix, c.prePago, c.outros, c.total];
}

export function GavetaMovimentacoes({ dados }: any) {
  const hoje = new Date();
  const primeiroDiaMes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`;
  const ultimoDiaMes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;

  const [de, setDe] = useState(primeiroDiaMes);
  const [ate, setAte] = useState(ultimoDiaMes);
  const [exibirEstornos, setExibirEstornos] = useState(false);
  const [listarCom, setListarCom] = useState<'todos' | 'servicos' | 'produtos'>('todos');
  const [tipoDesconto, setTipoDesconto] = useState('todos');
  const [filtroAtivo, setFiltroAtivo] = useState(false);
  const [mesesAbertos, setMesesAbertos] = useState<Record<string, boolean>>({});
  const [diasAbertos, setDiasAbertos] = useState<Record<string, boolean>>({});

  const financeiro: any[] = dados?.financeiro || [];

  const dadosFiltrados = useMemo(() => {
    if (!filtroAtivo) return [];
    return financeiro.filter((f: any) => {
      const data = localDateStr(f.data_movimentacao);
      if (data < de || data > ate) return false;
      if (f.tipo !== 'entrada') return false;
      if (!exibirEstornos && f.status === 'Estornado') return false;
      if (listarCom === 'servicos' && f.categoria === 'Venda de Produtos') return false;
      if (listarCom === 'produtos' && f.categoria !== 'Venda de Produtos') return false;
      if (tipoDesconto === 'sem_desconto' && Number(f.desconto || 0) > 0) return false;
      if (tipoDesconto !== 'todos' && tipoDesconto !== 'sem_desconto' && f.tipo_desconto !== tipoDesconto) return false;
      return true;
    });
  }, [filtroAtivo, financeiro, de, ate, exibirEstornos, listarCom, tipoDesconto]);

  const arvore = useMemo(() => {
    const meses: Record<string, Record<string, any[]>> = {};
    dadosFiltrados.forEach((f: any) => {
      const d = localDateStr(f.data_movimentacao);
      const ym = d.substring(0, 7);
      (meses[ym] ??= {});
      (meses[ym][d] ??= []).push(f);
    });
    return Object.entries(meses).sort(([a], [b]) => b.localeCompare(a)).map(([ym, dias]) => {
      const diasArr = Object.entries(dias).sort(([a], [b]) => a.localeCompare(b)).map(([dia, rows]) => ({
        dia, rows, total: rows.map(colunas).reduce(somar, ZERO),
      }));
      return { ym, dias: diasArr, total: diasArr.map(d => d.total).reduce(somar, ZERO) };
    });
  }, [dadosFiltrados]);

  const totalGeral = useMemo(() => arvore.map(m => m.total).reduce(somar, ZERO), [arvore]);

  function exportarCSV() {
    if (dadosFiltrados.length === 0) return;
    let csv = 'Data,Hora,Cliente,' + COLUNAS_LABEL.join(',') + '\n';
    dadosFiltrados.slice().sort((a, b) => String(a.data_movimentacao).localeCompare(String(b.data_movimentacao)))
      .forEach((f: any) => {
        const v = valores(colunas(f)).map(n => String(n.toFixed(2)).replace('.', ',')).join(',');
        const nome = String(f.cliente_nome || '').replace(/,/g, ' ');
        csv += `${formatarData(localDateStr(f.data_movimentacao))},${horaDe(f)},${nome},${v}\n`;
      });
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url; link.download = `movimentacoes_${de}_a_${ate}.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  }

  const inputStyle = { padding: '8px 10px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 12, color: C.textMain, background: C.bgCard, cursor: 'pointer' };
  const labelStyle = { fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase' as const, letterSpacing: '0.5px', display: 'block', marginBottom: 4 };

  // ── Célula de valor ──
  const td = (n: number, opts: { bold?: boolean; desconto?: boolean } = {}) => (
    <td style={{ padding: '7px 10px', textAlign: 'right', fontSize: 12, whiteSpace: 'nowrap',
      fontWeight: opts.bold ? 700 : 500,
      color: n === 0 ? C.textLight : opts.desconto ? C.danger : opts.bold ? C.sidebarBg : C.textMain }}>
      {opts.desconto && n > 0 ? '-' : ''}{brl(n)}
    </td>
  );
  const celulas = (c: Cols, bold = false) => (
    <>
      {td(c.servicos, { bold })}{td(c.produtos, { bold })}{td(c.descontos, { desconto: true })}
      {td(c.credito, { bold })}{td(c.debito, { bold })}{td(c.dinheiro, { bold })}
      {td(c.pix, { bold })}{td(c.prePago, { bold })}{td(c.outros, { bold })}{td(c.total, { bold: true })}
    </>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* CABEÇALHO */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexShrink: 0 }}>
        <div>
          <h2 className="font-title uppercase tracking-widest" style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.sidebarBg }}>Movimentações Financeiras</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: C.textMuted }}>Mês → Dia → Atendimento, com quebra por forma de pagamento</p>
        </div>
        <button onClick={exportarCSV} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: C.sidebarBg, color: '#fff', border: 'none', borderRadius: RAIO_MD, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          <FiDownload size={14} /> Exportar CSV
        </button>
      </div>

      {/* FILTROS */}
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, padding: 20, marginBottom: 20, flexShrink: 0 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
          <div><label style={labelStyle}>De</label><InputData value={de} onChange={setDe} style={inputStyle} /></div>
          <div><label style={labelStyle}>Até</label><InputData value={ate} onChange={setAte} min={de} style={inputStyle} /></div>
          <div>
            <label style={labelStyle}>Listar com</label>
            <select value={listarCom} onChange={e => setListarCom(e.target.value as any)} style={inputStyle}>
              <option value="todos">Todos</option><option value="servicos">Serviços</option><option value="produtos">Produtos</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Desconto</label>
            <select value={tipoDesconto} onChange={e => setTipoDesconto(e.target.value)} style={inputStyle}>
              <option value="todos">Todos</option><option value="Aniversário">Aniversário</option><option value="Fidelidade">Fidelidade</option>
              <option value="Cortesia">Cortesia</option><option value="Convênio">Convênio</option><option value="sem_desconto">Sem desconto</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 4 }}>
            <input type="checkbox" id="exibir_estornos" checked={exibirEstornos} onChange={e => setExibirEstornos(e.target.checked)} style={{ cursor: 'pointer', width: 15, height: 15 }} />
            <label htmlFor="exibir_estornos" style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, cursor: 'pointer' }}>Exibir estornos</label>
          </div>
          <button onClick={() => setFiltroAtivo(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: C.sidebarBg, color: '#fff', border: 'none', borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            <FiFilter size={14} /> Filtrar
          </button>
        </div>
      </div>

      {/* TABELA */}
      {!filtroAtivo ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textLight, fontSize: 14 }}>
          Configure o período e clique em <strong style={{ color: C.textMuted, margin: '0 4px' }}>Filtrar</strong>.
        </div>
      ) : arvore.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textMuted, fontSize: 14 }}>
          Nenhuma movimentação no período.
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 920 }}>
            <thead>
              <tr style={{ background: C.bg, position: 'sticky', top: 0, zIndex: 1 }}>
                <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', minWidth: 260 }}>Grupo</th>
                {COLUNAS_LABEL.map(l => (
                  <th key={l} style={{ textAlign: 'right', padding: '10px 10px', fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {arvore.map(mes => {
                const mesAberto = mesesAbertos[mes.ym] ?? true;
                return (
                  <Fragment key={mes.ym}>
                    {/* MÊS */}
                    <tr onClick={() => setMesesAbertos(p => ({ ...p, [mes.ym]: !mesAberto }))}
                      style={{ background: `${C.sidebarBg}12`, cursor: 'pointer', borderTop: `2px solid ${C.borderMid}` }}>
                      <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 800, color: C.sidebarBg }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {mesAberto ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />} {labelMes(mes.ym)}
                        </span>
                      </td>
                      {celulas(mes.total, true)}
                    </tr>

                    {mesAberto && mes.dias.map(d => {
                      const chaveDia = d.dia;
                      const diaAberto = diasAbertos[chaveDia] ?? false;
                      return (
                        <Fragment key={chaveDia}>
                          {/* DIA */}
                          <tr onClick={() => setDiasAbertos(p => ({ ...p, [chaveDia]: !diaAberto }))}
                            style={{ cursor: 'pointer', borderTop: `1px solid ${C.border}`, background: C.bgCard }}>
                            <td style={{ padding: '8px 12px 8px 28px', fontSize: 12.5, fontWeight: 700, color: C.textMain }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                {diaAberto ? <FiChevronDown size={12} /> : <FiChevronRight size={12} />}
                                {formatarData(d.dia)}
                                <span style={{ fontSize: 11, fontWeight: 500, color: C.textMuted }}>({d.rows.length})</span>
                              </span>
                            </td>
                            {celulas(d.total)}
                          </tr>

                          {/* ATENDIMENTOS */}
                          {diaAberto && d.rows.slice().sort((a, b) => String(a.data_movimentacao).localeCompare(String(b.data_movimentacao))).map((f: any, i: number) => (
                            <tr key={f.id || i} style={{ borderTop: `1px solid ${C.border}`, background: C.bg }}>
                              <td style={{ padding: '7px 12px 7px 48px', fontSize: 12, color: C.textMuted }}>
                                <span style={{ color: C.textMain, fontWeight: 500 }}>{f.cliente_nome || 'Balcão'}</span>
                                {horaDe(f) && <span style={{ marginLeft: 8, fontSize: 11 }}>{horaDe(f)}</span>}
                                {f.status === 'Estornado' && <span style={{ marginLeft: 8, fontSize: 10, color: C.danger, fontWeight: 700 }}>ESTORNADO</span>}
                              </td>
                              {celulas(colunas(f))}
                            </tr>
                          ))}
                        </Fragment>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: C.sidebarBg, position: 'sticky', bottom: 0 }}>
                <td style={{ padding: '12px', fontSize: 11, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Totais Gerais</td>
                {valores(totalGeral).map((n, i) => (
                  <td key={i} style={{ padding: '12px 10px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: i === 2 && n > 0 ? '#FCA5A5' : '#fff', whiteSpace: 'nowrap' }}>
                    {i === 2 && n > 0 ? '-' : ''}{brl(n)}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

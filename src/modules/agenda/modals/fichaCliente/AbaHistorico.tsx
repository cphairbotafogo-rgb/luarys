import { C, brl } from '@/lib/constants';
import { RAIO_LG } from '@/lib/estiloGlobal';
import { Badge } from '@/components/ui';
import { FiCalendar, FiShoppingBag } from 'react-icons/fi';

const formatarData = (d: string) => !d ? '--/--/----' : d.split('T')[0].split('-').reverse().join('/');

interface Props {
  carregando: boolean;
  historicoAgendamentos: any[];
  comprasProdutos: any[];
}

export function AbaHistorico({ carregando, historicoAgendamentos, comprasProdutos }: Props) {
  if (carregando) {
    return <p style={{ color: C.textMuted, textAlign: 'center', padding: 20, fontWeight: 500 }}>A buscar o histórico...</p>;
  }

  const servicosFin = historicoAgendamentos.filter((a: any) => a.status === 'Finalizado');
  const gastoServicos = servicosFin.reduce((s: number, a: any) => s + (Number(a.valor_final) || 0), 0);
  const gastoProdutos = comprasProdutos.reduce((s: number, c: any) => s + (Number(c.valor_total) || 0), 0);
  const totalGastoReal = gastoServicos + gastoProdutos;
  const nAtendimentos = servicosFin.length + comprasProdutos.length;
  const ticketMedio = nAtendimentos > 0 ? totalGastoReal / nAtendimentos : 0;

  if (historicoAgendamentos.length === 0 && comprasProdutos.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: C.textLight }}>
        <FiCalendar size={40} color={C.borderMid} style={{ marginBottom: 16 }} />
        <h3 className="font-title" style={{ color: C.textMain, margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>Nenhum registro nesta unidade</h3>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 4 }}>
        {[
          { label: 'Total Gasto', val: brl(totalGastoReal) },
          { label: 'Ticket Médio', val: brl(ticketMedio) },
          { label: 'Atendimentos', val: String(nAtendimentos) },
        ].map(({ label, val }) => (
          <div key={label} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: RAIO_LG, padding: '12px 14px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 800, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</p>
            <p className="font-title" style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.sidebarBg }}>{val}</p>
          </div>
        ))}
      </div>

      {historicoAgendamentos.length > 0 && (
        <>
          <p className="font-title uppercase" style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 800, color: C.textLight, letterSpacing: '0.5px' }}>Serviços</p>
          {historicoAgendamentos.map((ag: any) => (
            <div key={ag.id} style={{ padding: 16, border: `1px solid ${C.border}`, borderRadius: RAIO_LG, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.bg }}>
              <div>
                <p className="font-title" style={{ margin: '0 0 4px', fontWeight: 700, color: C.sidebarBg, fontSize: 14 }}>{ag.servicos?.nome_servico || 'Serviço Personalizado'}</p>
                <p style={{ margin: 0, fontSize: 12, color: C.textLight, fontWeight: 500 }}>{formatarData(ag.data)} às {ag.inicio}</p>
              </div>
              <Badge label={ag.status} style={{ bg: ag.status === 'Finalizado' ? '#F4F8F5' : '#F1F5F9', color: ag.status === 'Finalizado' ? '#3B4A3F' : C.textMuted }} />
            </div>
          ))}
        </>
      )}

      {comprasProdutos.length > 0 && (
        <>
          <p className="font-title uppercase" style={{ margin: '12px 0 2px', fontSize: 10, fontWeight: 800, color: C.textLight, letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <FiShoppingBag size={12} /> Compras de Produtos
          </p>
          {comprasProdutos.map((compra: any) => (
            <div key={compra.id} style={{ padding: 16, border: `1px solid ${C.border}`, borderRadius: RAIO_LG, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: C.bg, gap: 12 }}>
              <div style={{ flex: 1 }}>
                <p className="font-title" style={{ margin: '0 0 4px', fontWeight: 700, color: C.sidebarBg, fontSize: 13, lineHeight: 1.4 }}>
                  {(compra.itens || []).map((it: any) => `${it.nome}${it.qtd > 1 ? ` ×${it.qtd}` : ''}`).join(', ') || 'Produtos'}
                </p>
                <p style={{ margin: 0, fontSize: 12, color: C.textLight, fontWeight: 500 }}>{formatarData(compra.data_hora)} · {compra.forma_pagamento || '—'}</p>
              </div>
              <span className="font-title" style={{ fontWeight: 700, color: C.success, fontSize: 14, whiteSpace: 'nowrap' }}>{brl(compra.valor_total || 0)}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
